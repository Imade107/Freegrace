// 2D Island Navigation Map, Road-Network Dijkstra Routing & Turn-by-Turn GPS Directions for GeminIsland.

import { getIslandInlandMargin } from "./voxel/meadow_engine.js";
import { RACE_TRACK_WAYPOINTS } from "./voxel/race_system.js";
import { ISLAND_CITIES, RACE_PADDOCK_POS, SHOP_STORES } from "./world_catalog.js";

const MAP_WORLD_HALF = 182;

let cachedCoastline = null;
export function getCoastlinePolygon(samples = 112) {
  if (cachedCoastline) return cachedCoastline;
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const dx = Math.cos(theta);
    const dz = Math.sin(theta);
    let lo = 60;
    let hi = 190;
    for (let step = 0; step < 14; step++) {
      const mid = (lo + hi) * 0.5;
      if (getIslandInlandMargin(dx * mid, dz * mid) >= 0) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    pts.push({ x: dx * lo, z: dz * lo });
  }
  cachedCoastline = pts;
  return pts;
}

export function getCardinalDirection(dx, dz) {
  // World coordinate convention: -Z is North, +X is East, +Z is South, -X is West
  if (Math.hypot(dx, dz) < 0.01) return "ahead";
  const angleDeg = (Math.atan2(dx, -dz) * 180) / Math.PI; // 0 = North, 90 = East
  const norm = (angleDeg + 360) % 360;
  const dirs = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ];
  return dirs[Math.round(norm / 45) % 8];
}

function classifyTurn(prevDx, prevDz, nextDx, nextDz) {
  const lenA = Math.hypot(prevDx, prevDz);
  const lenB = Math.hypot(nextDx, nextDz);
  if (lenA < 0.1 || lenB < 0.1) return "Continue straight";
  const ax = prevDx / lenA;
  const az = prevDz / lenA;
  const bx = nextDx / lenB;
  const bz = nextDz / lenB;
  const dot = Math.max(-1, Math.min(1, ax * bx + az * bz));
  // 2D cross product in screen coords (x right, z down): positive = turning right
  const cross = ax * bz - az * bx;
  const angleDeg = (Math.acos(dot) * 180) / Math.PI;
  if (angleDeg < 22) return "Continue straight";
  if (angleDeg < 58) return cross > 0 ? "Bear right" : "Bear left";
  if (angleDeg < 132) return cross > 0 ? "Turn right" : "Turn left";
  return cross > 0 ? "Sharp right" : "Sharp left";
}

function roadWeightForKind(kind) {
  if (kind === "road" || kind === "cottage_road") return 0.78;
  if (kind === "boardwalk") return 0.85;
  if (kind === "trail") return 0.92;
  return 0.88;
}

let cachedGraphKey = "";
let cachedGraph = null;

export function buildRoadGraph(worldData) {
  const pathCount = Array.isArray(worldData?.paths) ? worldData.paths.length : 0;
  const key = `${pathCount}:${worldData?.paths?.[0]?.id || "base"}`;
  if (cachedGraph && cachedGraphKey === key) return cachedGraph;

  const nodes = [];
  const adj = [];

  function addNode(x, z, kind = "road") {
    const id = nodes.length;
    nodes.push({ id, x, z, kind });
    adj.push([]);
    return id;
  }

  function link(a, b, mult = 0.84) {
    if (a === b) return;
    const na = nodes[a];
    const nb = nodes[b];
    const d = Math.hypot(nb.x - na.x, nb.z - na.z);
    if (d < 0.05) return;
    const cost = d * mult;
    adj[a].push({ to: b, cost, dist: d });
    adj[b].push({ to: a, cost, dist: d });
  }

  const paths = Array.isArray(worldData?.paths) ? worldData.paths : [];
  for (const pathSpec of paths) {
    const rawPts = Array.isArray(pathSpec?.points) ? pathSpec.points : [];
    if (rawPts.length < 2) continue;
    const mult = roadWeightForKind(pathSpec.kind);
    const polyNodes = [];

    const segCount = pathSpec.closed ? rawPts.length : rawPts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const p0 = rawPts[i];
      const p1 = rawPts[(i + 1) % rawPts.length];
      if (!p0 || !p1) continue;
      const x0 = Number(p0[0]);
      const z0 = Number(p0[1]);
      const x1 = Number(p1[0]);
      const z1 = Number(p1[1]);
      if (!Number.isFinite(x0) || !Number.isFinite(z0) || !Number.isFinite(x1) || !Number.isFinite(z1)) {
        continue;
      }
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.max(1, Math.min(18, Math.ceil(segLen / 10)));
      const startStep = i === 0 ? 0 : 1;
      for (let s = startStep; s <= steps; s++) {
        if (pathSpec.closed && i === segCount - 1 && s === steps) break;
        const t = s / steps;
        const idx = addNode(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, pathSpec.kind || "road");
        polyNodes.push(idx);
      }
    }

    for (let i = 1; i < polyNodes.length; i++) {
      link(polyNodes[i - 1], polyNodes[i], mult);
    }
    if (pathSpec.closed && polyNodes.length >= 3) {
      link(polyNodes[polyNodes.length - 1], polyNodes[0], mult);
    }
  }

  // Ensure the outer Grand Prix / Ring Road waypoints form a continuous island highway loop
  const ringNodes = [];
  for (let i = 0; i < RACE_TRACK_WAYPOINTS.length; i++) {
    const [rx, rz] = RACE_TRACK_WAYPOINTS[i];
    ringNodes.push(addNode(rx, rz, "road"));
  }
  for (let i = 0; i < ringNodes.length; i++) {
    link(ringNodes[i], ringNodes[(i + 1) % ringNodes.length], 0.78);
  }

  // Stitch nearby road intersections so routes transfer smoothly between avenues & alleys
  const stitchRadius = 11.5;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.abs(dx) > stitchRadius || Math.abs(dz) > stitchRadius) continue;
      const d = Math.hypot(dx, dz);
      if (d <= stitchRadius) {
        const alreadyLinked = adj[i].some((e) => e.to === j);
        if (!alreadyLinked) {
          link(i, j, 0.96);
        }
      }
    }
  }

  cachedGraphKey = key;
  cachedGraph = { nodes, adj };
  return cachedGraph;
}

export function computeRoute(worldData, fromX, fromZ, toX, toZ, destName = "Destination") {
  const sx = Number(fromX) || 0;
  const sz = Number(fromZ) || 0;
  const tx = Number(toX) || 0;
  const tz = Number(toZ) || 0;
  const directDist = Math.hypot(tx - sx, tz - sz);

  if (directDist <= 14) {
    const dir = getCardinalDirection(tx - sx, tz - sz);
    const meters = Math.max(1, Math.round(directDist));
    const singleInstr =
      meters <= 5
        ? `Arrived right outside ${destName}`
        : `Head ${dir} ${meters} m directly to ${destName}`;
    return {
      points: [
        { x: sx, z: sz },
        { x: tx, z: tz },
      ],
      totalMeters: meters,
      directMeters: meters,
      etaWalkSec: Math.max(2, Math.round(meters / 6.0)),
      destName,
      steps: [
        {
          index: 1,
          kind: meters <= 5 ? "arrive" : "start",
          turn: meters <= 5 ? "Arrive" : `Head ${dir}`,
          cardinal: dir,
          distMeters: meters,
          instruction: singleInstr,
          x: tx,
          z: tz,
        },
      ],
      nextInstruction: singleInstr,
      voiceBrief: singleInstr,
    };
  }

  const graph = buildRoadGraph(worldData);
  const baseN = graph.nodes.length;
  const startId = baseN;
  const endId = baseN + 1;
  const totalN = baseN + 2;

  const extraAdjStart = [];
  const extraAdjEnd = new Map();

  // Attach start and destination to their 3 closest road nodes
  const nearestStart = graph.nodes
    .map((n) => ({ id: n.id, d: Math.hypot(n.x - sx, n.z - sz) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  for (const cand of nearestStart) {
    extraAdjStart.push({ to: cand.id, cost: cand.d * 1.05, dist: cand.d });
  }
  // Direct off-road shortcut option with higher terrain penalty so road route wins unless direct is much shorter
  extraAdjStart.push({ to: endId, cost: directDist * 1.38, dist: directDist });

  const nearestEnd = graph.nodes
    .map((n) => ({ id: n.id, d: Math.hypot(n.x - tx, n.z - tz) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  for (const cand of nearestEnd) {
    extraAdjEnd.set(cand.id, { to: endId, cost: cand.d * 1.05, dist: cand.d });
  }

  // Compact Dijkstra over <=320 nodes
  const distArr = new Float64Array(totalN);
  const costArr = new Float64Array(totalN);
  const prevArr = new Int32Array(totalN);
  const visited = new Uint8Array(totalN);
  distArr.fill(Infinity);
  costArr.fill(Infinity);
  prevArr.fill(-1);
  costArr[startId] = 0;
  distArr[startId] = 0;

  for (let iter = 0; iter < totalN; iter++) {
    let u = -1;
    let bestC = Infinity;
    for (let i = 0; i < totalN; i++) {
      if (!visited[i] && costArr[i] < bestC) {
        bestC = costArr[i];
        u = i;
      }
    }
    if (u === -1 || u === endId || !Number.isFinite(bestC)) break;
    visited[u] = 1;

    const edges =
      u === startId
        ? extraAdjStart
        : u < baseN
          ? extraAdjEnd.has(u)
            ? [...graph.adj[u], extraAdjEnd.get(u)]
            : graph.adj[u]
          : [];

    for (const e of edges) {
      if (visited[e.to]) continue;
      const nc = costArr[u] + e.cost;
      if (nc < costArr[e.to]) {
        costArr[e.to] = nc;
        distArr[e.to] = distArr[u] + e.dist;
        prevArr[e.to] = u;
      }
    }
  }

  const rawPoints = [];
  if (prevArr[endId] !== -1) {
    const rev = [];
    let cur = endId;
    while (cur !== -1) {
      if (cur === startId) rev.push({ x: sx, z: sz });
      else if (cur === endId) rev.push({ x: tx, z: tz });
      else rev.push({ x: graph.nodes[cur].x, z: graph.nodes[cur].z });
      cur = prevArr[cur];
    }
    rev.reverse();
    rawPoints.push(...rev);
  } else {
    rawPoints.push({ x: sx, z: sz }, { x: tx, z: tz });
  }

  // Simplify micro-jitter / near-collinear nodes while preserving real turns
  const simplified = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const cur = rawPoints[i];
    const next = rawPoints[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.z - prev.z);
    const d2 = Math.hypot(next.x - cur.x, next.z - cur.z);
    if (d1 < 5.5 && rawPoints.length > 3) continue;
    if (d1 > 0.2 && d2 > 0.2) {
      const dot =
        ((cur.x - prev.x) / d1) * ((next.x - cur.x) / d2) +
        ((cur.z - prev.z) / d1) * ((next.z - cur.z) / d2);
      if (dot > 0.955) continue;
    }
    simplified.push(cur);
  }
  simplified.push(rawPoints[rawPoints.length - 1]);

  let totalMeters = 0;
  for (let i = 1; i < simplified.length; i++) {
    totalMeters += Math.hypot(
      simplified[i].x - simplified[i - 1].x,
      simplified[i].z - simplified[i - 1].z,
    );
  }
  totalMeters = Math.max(1, Math.round(totalMeters));

  const steps = [];
  for (let i = 0; i < simplified.length - 1; i++) {
    const a = simplified[i];
    const b = simplified[i + 1];
    const segM = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z)));
    const cardinal = getCardinalDirection(b.x - a.x, b.z - a.z);
    if (i === 0) {
      steps.push({
        index: steps.length + 1,
        kind: "start",
        turn: `Head ${cardinal}`,
        cardinal,
        distMeters: segM,
        instruction: `Head ${cardinal} for ${segM} m`,
        x: b.x,
        z: b.z,
      });
    } else {
      const prevA = simplified[i - 1];
      const turnLabel = classifyTurn(a.x - prevA.x, a.z - prevA.z, b.x - a.x, b.z - a.z);
      const isLast = i === simplified.length - 2;
      steps.push({
        index: steps.length + 1,
        kind: isLast ? "arrive" : "turn",
        turn: turnLabel,
        cardinal,
        distMeters: segM,
        instruction: isLast
          ? `${turnLabel} ${cardinal} for ${segM} m to ${destName}`
          : `${turnLabel} ${cardinal} for ${segM} m`,
        x: b.x,
        z: b.z,
      });
    }
  }

  if (steps.length === 1) {
    steps[0].instruction = `Head ${steps[0].cardinal} ${steps[0].distMeters} m to ${destName}`;
  }

  const etaWalkSec = Math.max(2, Math.round(totalMeters / 6.0));
  const nextInstruction =
    steps.length >= 2
      ? `${steps[0].instruction}, then ${steps[1].turn.toLowerCase()}`
      : steps[0]?.instruction || `Head to ${destName}`;

  const voiceBrief =
    steps.length >= 2
      ? `Route to ${destName}: ${totalMeters} meters. ${steps[0].instruction}, then ${steps[1].instruction}.`
      : `Route to ${destName}: ${steps[0]?.instruction || `${totalMeters} meters ahead`}.`;

  return {
    points: simplified,
    totalMeters,
    directMeters: Math.round(directDist),
    etaWalkSec,
    destName,
    steps,
    nextInstruction,
    voiceBrief,
  };
}

function getAllLandmarks(worldData) {
  const creations = Array.isArray(worldData?.creations) ? worldData.creations : [];
  return creations.filter(
    (c) =>
      c &&
      !c.isCompanion &&
      (c.category === "building" || c.behavior?.type === "landmark") &&
      typeof c.x === "number" &&
      typeof c.z === "number",
  );
}

function drawPlayerArrow(ctx, sx, sy, yawRad, color = "#1f6feb") {
  // yawRad: camera/player azimuth where yaw=0 looks toward -Z (screen North / up)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-yawRad);
  ctx.beginPath();
  ctx.moveTo(0, -8.5);
  ctx.lineTo(6.2, 6.5);
  ctx.lineTo(0, 3.2);
  ctx.lineTo(-6.2, 6.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
}

function drawPinMarker(ctx, sx, sy, label, fillColor, pulse = false) {
  ctx.save();
  if (pulse) {
    const phase = (performance.now() * 0.003) % 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 8 + phase * 10, 0, Math.PI * 2);
    ctx.strokeStyle = fillColor;
    ctx.globalAlpha = (1 - phase) * 0.45;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(sx, sy, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  if (label) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, sx, sy + 0.5);
  }
  ctx.restore();
}

export function renderMinimapCanvas(canvas, state) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const wCss = canvas.clientWidth || 136;
  const hCss = canvas.clientHeight || 136;
  if (canvas.width !== Math.round(wCss * dpr) || canvas.height !== Math.round(hCss * dpr)) {
    canvas.width = Math.round(wCss * dpr);
    canvas.height = Math.round(hCss * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  const cx = wCss * 0.5;
  const cy = hCss * 0.5;
  const pxPerMeter = 1.05;
  const refX = Number(state?.playerX) || 0;
  const refZ = Number(state?.playerZ) || 0;

  const toScreen = (wx, wz) => [
    cx + (wx - refX) * pxPerMeter,
    cy + (wz - refZ) * pxPerMeter,
  ];

  // Ocean background
  ctx.fillStyle = "#bce5f2";
  ctx.fillRect(0, 0, wCss, hCss);

  // Island terrain polygon
  const coast = getCoastlinePolygon();
  ctx.beginPath();
  coast.forEach((p, idx) => {
    const [sx, sy] = toScreen(p.x, p.z);
    if (idx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = "#cbe8ba";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f2dfb0";
  ctx.stroke();

  // Ponds / water
  const ponds = Array.isArray(state?.worldData?.ponds) ? state.worldData.ponds : [];
  for (const pond of ponds) {
    const [sx, sy] = toScreen(pond.x || 0, pond.z || 0);
    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy,
      Math.max(3, (pond.rx || 7) * pxPerMeter),
      Math.max(3, (pond.rz || 6) * pxPerMeter),
      pond.rot || 0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#76c8e8";
    ctx.fill();
  }

  // Road network
  const paths = Array.isArray(state?.worldData?.paths) ? state.worldData.paths : [];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pathSpec of paths) {
    const pts = pathSpec?.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt[0], pt[1]);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    if (pathSpec.closed) ctx.closePath();
    ctx.lineWidth = pathSpec.kind === "road" || pathSpec.kind === "cottage_road" ? 4.2 : 2.5;
    ctx.strokeStyle = pathSpec.kind === "trail" ? "#dcc8a3" : "#eef2ee";
    ctx.stroke();
  }

  // Grand Prix Track overlay
  ctx.beginPath();
  RACE_TRACK_WAYPOINTS.forEach((pt, idx) => {
    const [sx, sy] = toScreen(pt[0], pt[1]);
    if (idx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(217, 119, 36, 0.38)";
  ctx.stroke();

  // Buildings
  const buildings = getAllLandmarks(state?.worldData);
  for (const b of buildings) {
    const [sx, sy] = toScreen(b.x, b.z);
    if (sx < -12 || sx > wCss + 12 || sy < -12 || sy > hCss + 12) continue;
    const isShop = SHOP_STORES.some((st) => st.creationMatch.test(b.name || ""));
    ctx.fillStyle = isShop ? "#e49d2d" : "#879789";
    ctx.fillRect(sx - 2.6, sy - 2.6, 5.2, 5.2);
  }

  // Route polyline
  const routePts = state?.route?.points;
  if (Array.isArray(routePts) && routePts.length >= 2) {
    ctx.save();
    ctx.beginPath();
    routePts.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(18, 118, 224, 0.3)";
    ctx.stroke();

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#1276e0";
    ctx.stroke();
    ctx.restore();
  }

  // Treasury Bank & Streetball Court markers on minimap
  {
    const overlay = state?.policeOverlay;
    if (overlay?.bank) {
      const [bx, by] = toScreen(overlay.bank.x, overlay.bank.z);
      if (bx >= -12 && bx <= wCss + 12 && by >= -12 && by <= hCss + 12) {
        drawPinMarker(ctx, bx, by, "$", "#ca8a04", false);
      }
    }
    const [cx, cyCourt] = toScreen(18.2, 11.9);
    if (cx >= -12 && cx <= wCss + 12 && cyCourt >= -12 && cyCourt <= hCss + 12) {
      drawPinMarker(ctx, cx, cyCourt, "B", "#ea580c", false);
    }
    const cruisers = Array.isArray(overlay?.cruisers) ? overlay.cruisers : [];
    for (const cr of cruisers) {
      const [rx, ry] = toScreen(cr.x, cr.z);
      if (rx < -10 || rx > wCss + 10 || ry < -10 || ry > hCss + 10) continue;
      ctx.beginPath();
      ctx.arc(rx, ry, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = cr.pursuit ? "#dc2626" : "#1d4ed8";
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  // Active Delivery / Custom Pin
  const mission = state?.activeMission;
  if (mission) {
    const isPickup = mission.phase === "to_pickup";
    const [px, py] = toScreen(
      mission.waypointX ?? (isPickup ? mission.pickupX : mission.dropoffX),
      mission.waypointZ ?? (isPickup ? mission.pickupZ : mission.dropoffZ),
    );
    drawPinMarker(ctx, px, py, isPickup ? "P" : "D", isPickup ? "#e07a16" : "#25854b", true);
  } else if (state?.customTarget) {
    const [tx, ty] = toScreen(state.customTarget.x, state.customTarget.z);
    drawPinMarker(ctx, tx, ty, "★", "#2563eb", true);
  }

  // Connected multiplayer peers (real peers from MultiplayerHub)
  const peers = Array.isArray(state?.peers) ? state.peers : [];
  for (const peer of peers) {
    if (!peer || !Number.isFinite(peer.x) || !Number.isFinite(peer.z)) continue;
    const [rx, ry] = toScreen(peer.x, peer.z);
    if (rx < -10 || rx > wCss + 10 || ry < -10 || ry > hCss + 10) continue;
    ctx.beginPath();
    ctx.arc(rx, ry, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = "#7c3aed";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  // Player heading arrow
  drawPlayerArrow(ctx, cx, cy, Number(state?.playerYaw) || 0, "#1276e0");

  // Subtle North badge at top of minimap
  ctx.fillStyle = "rgba(22, 27, 24, 0.72)";
  ctx.fillRect(wCss * 0.5 - 9, 4, 18, 13);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 9px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", wCss * 0.5, 10.5);

  ctx.restore();
}

export function getMapViewportTransform(canvas, view) {
  const w = canvas.clientWidth || 360;
  const h = canvas.clientHeight || 260;
  const baseScale = Math.min(w, h) / (MAP_WORLD_HALF * 2);
  const zoom = Math.max(0.85, Math.min(4.0, Number(view?.zoom) || 1.05));
  const scale = baseScale * zoom;
  const panX = Number(view?.panX) || 0;
  const panZ = Number(view?.panZ) || 0;
  const cx = w * 0.5;
  const cy = h * 0.5;
  return {
    w,
    h,
    scale,
    toScreen: (wx, wz) => [cx + (wx - panX) * scale, cy + (wz - panZ) * scale],
    toWorld: (sx, sy) => ({
      x: (sx - cx) / scale + panX,
      z: (sy - cy) / scale + panZ,
    }),
  };
}

export function hitTestFullMap(canvas, clientX, clientY, state) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const { toScreen, toWorld } = getMapViewportTransform(canvas, state?.view);
  const worldPt = toWorld(sx, sy);

  // Check landmarks first (within 14px click tolerance)
  const landmarks = getAllLandmarks(state?.worldData);
  let bestBuilding = null;
  let bestPx = 15;
  for (const b of landmarks) {
    const [bx, by] = toScreen(b.x, b.z);
    const dPx = Math.hypot(bx - sx, by - sy);
    if (dPx < bestPx) {
      bestPx = dPx;
      bestBuilding = b;
    }
  }
  if (bestBuilding) {
    return {
      kind: "building",
      id: bestBuilding.id,
      name: bestBuilding.name,
      x: bestBuilding.x,
      z: bestBuilding.z,
    };
  }

  // Check cities badges
  for (const c of ISLAND_CITIES) {
    const [cx, cy] = toScreen(c.centerX, c.centerZ);
    if (Math.hypot(cx - sx, cy - sy) < 18) {
      return {
        kind: "city",
        id: c.id,
        name: c.name,
        x: c.spawnX,
        z: c.spawnZ,
      };
    }
  }

  // Check Grand Prix Paddock
  {
    const [rx, ry] = toScreen(RACE_PADDOCK_POS.x, RACE_PADDOCK_POS.z);
    if (Math.hypot(rx - sx, ry - sy) < 16) {
      return {
        kind: "paddock",
        id: "race_paddock",
        name: "Grand Prix Start Paddock",
        x: RACE_PADDOCK_POS.x,
        z: RACE_PADDOCK_POS.z,
      };
    }
  }

  // Check Island Treasury Bank & Streetball Court
  {
    const bank = state?.policeOverlay?.bank || { x: 26, z: 22, name: "Island Treasury Bank" };
    const [bx, by] = toScreen(bank.x, bank.z);
    if (Math.hypot(bx - sx, by - sy) < 16) {
      return {
        kind: "bank",
        id: "treasury-bank-vault",
        name: "Island Treasury Bank (Vault)",
        x: bank.x,
        z: bank.z,
      };
    }
    const [cx, cyCourt] = toScreen(18.2, 11.9);
    if (Math.hypot(cx - sx, cyCourt - sy) < 16) {
      return {
        kind: "basketball",
        id: "c-mvps7u0f-bfe8c5",
        name: "Streetball Half-Court Hoop",
        x: 18.2,
        z: 11.9,
      };
    }
  }

  // Check connected multiplayer peers
  const peers = Array.isArray(state?.peers) ? state.peers : [];
  for (const peer of peers) {
    if (!peer || !Number.isFinite(peer.x) || !Number.isFinite(peer.z)) continue;
    const [px, py] = toScreen(peer.x, peer.z);
    if (Math.hypot(px - sx, py - sy) < 15) {
      return {
        kind: "peer",
        id: peer.id,
        name: `${peer.name || "Explorer"} (Online)`,
        x: peer.x,
        z: peer.z,
      };
    }
  }

  // Any point on island terrain
  const margin = getIslandInlandMargin(worldPt.x, worldPt.z);
  if (margin >= -2) {
    return {
      kind: "point",
      id: "custom-pin",
      name: `Dropped Pin (${Math.round(worldPt.x)}, ${Math.round(worldPt.z)})`,
      x: Math.round(worldPt.x * 10) / 10,
      z: Math.round(worldPt.z * 10) / 10,
    };
  }

  return null;
}

export function renderFullMapCanvas(canvas, state) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const wCss = canvas.clientWidth || 360;
  const hCss = canvas.clientHeight || 260;
  if (canvas.width !== Math.round(wCss * dpr) || canvas.height !== Math.round(hCss * dpr)) {
    canvas.width = Math.round(wCss * dpr);
    canvas.height = Math.round(hCss * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { scale, toScreen } = getMapViewportTransform(canvas, state?.view);

  ctx.save();
  ctx.scale(dpr, dpr);

  // Sunlit ocean gradient background
  const oceanGrad = ctx.createRadialGradient(
    wCss * 0.5,
    hCss * 0.45,
    20,
    wCss * 0.5,
    hCss * 0.5,
    Math.max(wCss, hCss) * 0.72,
  );
  oceanGrad.addColorStop(0, "#cdeefa");
  oceanGrad.addColorStop(1, "#9bd4ea");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, wCss, hCss);

  // Subtle nautical grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  for (let g = -160; g <= 160; g += 40) {
    const [gx] = toScreen(g, 0);
    const [, gy] = toScreen(0, g);
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, hCss);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(wCss, gy);
    ctx.stroke();
  }

  // Island shoreline & meadow surface
  const coast = getCoastlinePolygon();
  ctx.beginPath();
  coast.forEach((p, idx) => {
    const [sx, sy] = toScreen(p.x, p.z);
    if (idx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fillStyle = "#d3ebb9";
  ctx.fill();
  ctx.lineWidth = Math.max(2.5, scale * 3.5);
  ctx.strokeStyle = "#f2dfb0";
  ctx.stroke();

  // Ponds
  const ponds = Array.isArray(state?.worldData?.ponds) ? state.worldData.ponds : [];
  for (const pond of ponds) {
    const [sx, sy] = toScreen(pond.x || 0, pond.z || 0);
    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy,
      Math.max(4, (pond.rx || 7) * scale),
      Math.max(4, (pond.rz || 6) * scale),
      pond.rot || 0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "#76c8e8";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#5db3d6";
    ctx.stroke();
  }

  // Roads & trails
  const paths = Array.isArray(state?.worldData?.paths) ? state.worldData.paths : [];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pathSpec of paths) {
    const pts = pathSpec?.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt[0], pt[1]);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    if (pathSpec.closed) ctx.closePath();
    const isRoad = pathSpec.kind === "road" || pathSpec.kind === "cottage_road";
    ctx.lineWidth = Math.max(2, (isRoad ? 3.8 : 2.1) * scale);
    ctx.strokeStyle = isRoad ? "#f6f7f4" : "#e6d2aa";
    ctx.stroke();
  }

  // Grand Prix ring loop highlight
  ctx.beginPath();
  RACE_TRACK_WAYPOINTS.forEach((pt, idx) => {
    const [sx, sy] = toScreen(pt[0], pt[1]);
    if (idx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.lineWidth = Math.max(1.5, scale * 1.4);
  ctx.strokeStyle = "rgba(217, 119, 36, 0.32)";
  ctx.stroke();

  // Buildings
  const buildings = getAllLandmarks(state?.worldData);
  const hoveredId = state?.hoverHit?.id || null;
  const activeMission = state?.activeMission;
  for (const b of buildings) {
    const [sx, sy] = toScreen(b.x, b.z);
    const isShop = SHOP_STORES.some((st) => st.creationMatch.test(b.name || ""));
    const isHovered = hoveredId && hoveredId === b.id;
    const isMissionStop =
      activeMission && (b.id === activeMission.pickupId || b.id === activeMission.dropoffId);
    const size = Math.max(4.5, Math.min(11, scale * 4.5));

    ctx.fillStyle = isMissionStop ? "#1f7a44" : isShop ? "#e39522" : "#6b7d6f";
    ctx.strokeStyle = isHovered ? "#111827" : "#ffffff";
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(sx - size * 0.5, sy - size * 0.5, size, size, 2);
    ctx.fill();
    ctx.stroke();
  }

  // District labels
  ctx.font = "650 10px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of ISLAND_CITIES) {
    const [sx, sy] = toScreen(c.centerX, c.centerZ);
    const badgeW = ctx.measureText(c.badge).width + 12;
    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    ctx.beginPath();
    ctx.roundRect(sx - badgeW * 0.5, sy - 9, badgeW, 17, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(22, 27, 24, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = c.accent || "#243b2c";
    ctx.fillText(c.badge, sx, sy);
  }

  // Active route line
  const routePts = state?.route?.points;
  if (Array.isArray(routePts) && routePts.length >= 2) {
    ctx.save();
    ctx.beginPath();
    routePts.forEach((pt, idx) => {
      const [sx, sy] = toScreen(pt.x, pt.z);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = "rgba(18, 118, 224, 0.28)";
    ctx.stroke();

    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#1276e0";
    ctx.stroke();
    ctx.restore();
  }

  // Paddock flag marker
  {
    const [rx, ry] = toScreen(RACE_PADDOCK_POS.x, RACE_PADDOCK_POS.z);
    ctx.fillStyle = "#d97724";
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Bank Vault, Streetball Court & Police Patrol Cruisers
  {
    const overlay = state?.policeOverlay;
    const bank = overlay?.bank || { x: 26, z: 22 };
    const [bx, by] = toScreen(bank.x, bank.z);
    drawPinMarker(ctx, bx, by, "$", "#ca8a04", false);

    const [cx, cyCourt] = toScreen(18.2, 11.9);
    drawPinMarker(ctx, cx, cyCourt, "B", "#ea580c", false);

    const cruisers = Array.isArray(overlay?.cruisers) ? overlay.cruisers : [];
    for (const cr of cruisers) {
      const [px, py] = toScreen(cr.x, cr.z);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = cr.pursuit ? "#dc2626" : "#1d4ed8";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.restore();
    }
  }

  // Mission Pickup & Dropoff pins
  if (activeMission) {
    const isPickup = activeMission.phase === "to_pickup";
    const [px, py] = toScreen(activeMission.pickupX, activeMission.pickupZ);
    const [dx, dy] = toScreen(activeMission.dropoffX, activeMission.dropoffZ);
    if (isPickup) {
      drawPinMarker(ctx, dx, dy, "D", "#8c9a90", false);
      drawPinMarker(ctx, px, py, "P", "#e07a16", true);
    } else {
      drawPinMarker(ctx, dx, dy, "D", "#25854b", true);
    }
  } else if (state?.customTarget) {
    const [tx, ty] = toScreen(state.customTarget.x, state.customTarget.z);
    drawPinMarker(ctx, tx, ty, "★", "#2563eb", true);
  }

  // Connected multiplayer peers
  const peers = Array.isArray(state?.peers) ? state.peers : [];
  for (const peer of peers) {
    if (!peer || !Number.isFinite(peer.x) || !Number.isFinite(peer.z)) continue;
    const [rx, ry] = toScreen(peer.x, peer.z);
    const label = typeof peer.name === "string" && peer.name.trim() ? peer.name.trim() : "Explorer";
    ctx.save();
    ctx.beginPath();
    ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "#7c3aed";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.font = "650 9.5px -apple-system, BlinkMacSystemFont, sans-serif";
    const lw = Math.min(96, ctx.measureText(label).width + 8);
    ctx.fillStyle = "rgba(76, 29, 149, 0.86)";
    ctx.beginPath();
    ctx.roundRect(rx - lw * 0.5, ry - 18, lw, 13, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rx, ry - 11.5, lw - 6);
    ctx.restore();
  }

  // Player heading arrow
  {
    const [px, py] = toScreen(Number(state?.playerX) || 0, Number(state?.playerZ) || 0);
    drawPlayerArrow(ctx, px, py, Number(state?.playerYaw) || 0, "#1276e0");
  }

  // Hover tooltip pill inside full map canvas
  if (state?.hoverHit?.name) {
    const [hx, hy] = toScreen(state.hoverHit.x, state.hoverHit.z);
    const txt = state.hoverHit.name;
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
    const tw = Math.min(200, ctx.measureText(txt).width + 14);
    const tx = Math.max(8, Math.min(wCss - tw - 8, hx - tw * 0.5));
    const ty = Math.max(8, hy - 28);
    ctx.fillStyle = "rgba(22, 27, 24, 0.9)";
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, 21, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, tx + tw * 0.5, ty + 10.5, tw - 8);
  }

  ctx.restore();
}
