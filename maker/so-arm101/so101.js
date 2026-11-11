/* SO-ARM101 페이지 스크립트
   1) 설명서: 내 포트·이름으로 명령어 채우기, 복사 단추, 목차
   2) 3D: URDF(TheRobotStudio SO-ARM100, Apache-2.0)를 줄인 model/so101.json + so101.bin 을 읽어 로봇 조립
   3) 조립 순서 뷰어, 4) 리더-팔로워 연동 시뮬레이션, 5) 캘리브레이션 연습 */
(function () {
  "use strict";

  /* ───────── 공통 ───────── */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];
  var JK = { shoulder_pan: "받침 회전", shoulder_lift: "어깨", elbow_flex: "팔꿈치", wrist_flex: "손목 굽힘", wrist_roll: "손목 회전", gripper: "그리퍼" };
  var MOTOR_LINK = { base_link: 1, shoulder_link: 2, upper_arm_link: 3, lower_arm_link: 4, wrist_link: 5, gripper_link: 6 };
  var GEAR = { follower: { 1: 345, 2: 345, 3: 345, 4: 345, 5: 345, 6: 345 }, leader: { 1: 191, 2: 345, 3: 191, 4: 147, 5: 147, 6: 147 } };
  var PART_KO = {
    base_so101_v2: "받침(베이스)", base_motor_holder_so101_v1: "받침 모터 홀더", waveshare_mounting_plate_so101_v2: "보드 장착판",
    motor_holder_so101_base_v1: "어깨 모터 홀더", rotation_pitch_so101_v1: "어깨 부품(회전대)", upper_arm_so101_v1: "위팔",
    under_arm_so101_v1: "아래팔", motor_holder_so101_wrist_v1: "4번 모터 홀더", wrist_roll_pitch_so101_v2: "손목 홀더",
    wrist_roll_follower_so101_v1: "그리퍼 몸체(고정 집게)", moving_jaw_so101_v1: "움직이는 집게",
    Wrist_Roll_SO101: "핸들 연결부", Handle_SO101: "손잡이(핸들)", Trigger_SO101: "트리거",
    board: "컨트롤러 보드", cable: "3핀 케이블 (보드→1→…→6)"
  };

  /* ───────── 1. 설명서 ───────── */
  var FIELDS = { lport: "in-lport", fport: "in-fport", lid: "in-lid", fid: "in-fid" };
  var my = {};
  function readMine() {
    Object.keys(FIELDS).forEach(function (k) {
      var el = $(FIELDS[k]);
      var v = el.value.trim().replace(/\s+/g, "");
      if (k === "lport" || k === "fport") v = v.toUpperCase();
      my[k] = v || el.defaultValue;
    });
  }
  function renderCmds() {
    readMine();
    document.querySelectorAll(".cmd[data-tpl]").forEach(function (el) {
      var tpl = el.getAttribute("data-tpl");
      var html = esc(tpl).replace(/\{(lport|fport|lid|fid)\}/g, function (_, k) { return '<span class="v">' + esc(my[k]) + "</span>"; });
      el.innerHTML = html;
      addCopy(el);
    });
    updateTerm && updateTerm(true);
  }
  function addCopy(el) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = "복사";
    b.addEventListener("click", function () {
      var text = el.textContent.replace(/복사됨|복사$/, "").trim();
      var done = function () { b.textContent = "복사됨"; setTimeout(function () { b.textContent = "복사"; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
    });
    el.appendChild(b);
  }
  function fallbackCopy(t) {
    var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove();
  }
  Object.keys(FIELDS).forEach(function (k) {
    var el = $(FIELDS[k]);
    var saved = store("so101-" + k);
    if (saved) el.value = saved;
    el.addEventListener("input", function () { store("so101-" + k, el.value.trim()); renderCmds(); });
  });
  document.querySelectorAll(".cmd:not([data-tpl])").forEach(addCopy);

  // 흐름 링크 → 해당 단계 펼치기
  function openStep(id) { var d = $(id); if (d && d.tagName === "DETAILS") d.open = true; }
  document.querySelectorAll('a[href^="#m"]').forEach(function (a) {
    a.addEventListener("click", function () { openStep(a.getAttribute("href").slice(1)); });
  });
  if (/^#m\d$/.test(location.hash)) openStep(location.hash.slice(1));
  document.querySelectorAll('a[href="#motor-table"]').forEach(function (a) { a.addEventListener("click", function () { openStep("m5"); }); });

  // 목차 강조
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#toc a"));
  if ("IntersectionObserver" in window) {
    var secIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("section.block").forEach(function (s) { secIO.observe(s); });
  }

  var updateTerm = null; // 시뮬레이션 준비 후 채워짐
  renderCmds();

  /* ───────── 2. 3D 준비 ───────── */
  if (!window.THREE) {
    ["asm-status", "sim-status"].forEach(function (id) { $(id).textContent = "3D 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."; });
    return;
  }
  var T = THREE;
  var GEOM = {};
  var MODEL = null;

  function decode(buf, meta) {
    Object.keys(meta.geoms).forEach(function (name) {
      var m = meta.geoms[name];
      var q = new Int16Array(buf, m.po, m.v * 3);
      var p = new Float32Array(m.v * 3);
      for (var i = 0; i < p.length; i++) { var a = i % 3; p[i] = (q[i] + 32767) * m.s[a] + m.lo[a]; }
      var n = new Int8Array(buf, m.no, m.v * 3).slice();
      var idx = m.u32 ? new Uint32Array(buf, m.io, m.i).slice() : new Uint16Array(buf, m.io, m.i).slice();
      var g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setAttribute("normal", new T.BufferAttribute(n, 3, true));
      g.setIndex(new T.BufferAttribute(idx, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      GEOM[name] = g;
    });
  }

  var COLORS = {
    follower: 0xE8833A, leader: 0x4F86C6, motor: 0x2B3036,
    g345: 0x3A4048, g191: 0x1E9C8E, g147: 0x8C5BC4,
    board: 0x1F6E43, cable: 0xE9C73A, steel: 0xC3C9D0, brass: 0xC9A04A
  };
  var FASTENER_KO = {
    screw_m3x6: "M3×6 나사", screw_m2x6: "M2×6 나사", screw_m2x5: "M2×6 나사", screw_m25x4: "M2.5×4 나사 (보드용)",
    nut_m3_555: "M3 너트", nut_m3_934: "M3 너트", spacer_m25: "M2.5 육각 스페이서"
  };
  function itemName(it) {
    if (it.kind === "motor") return it.motor + "번 모터 · " + JK[JOINTS[it.motor - 1]];
    if (FASTENER_KO[it.g]) return FASTENER_KO[it.g];
    if (it.kind === "cable") return it.g === "connector" ? "케이블 커넥터" : "3핀 케이블";
    return PART_KO[it.id] || it.id;
  }
  function rpyEuler(rpy) { return new T.Euler(rpy[0], rpy[1], rpy[2], "ZYX"); }

  /* CAD 부품 목록 + URDF 관절 → three 객체. 바깥 group 이 Z-up 을 Y-up 으로, 로봇 앞을 화면 앞으로 돌린다. */
  function buildRobot(kind, opts) {
    opts = opts || {};
    var outer = new T.Group();
    outer.rotation.y = -Math.PI / 2;
    var root = new T.Group();
    root.rotation.x = -Math.PI / 2;
    outer.add(root);
    var links = { base_link: new T.Group() };
    root.add(links.base_link);
    var joints = {};
    var byParent = {};
    MODEL[kind + "Joints"].forEach(function (j) { (byParent[j.parent] = byParent[j.parent] || []).push(j); });
    (function walk(parent) {
      (byParent[parent] || []).forEach(function (j) {
        var origin = new T.Group();
        origin.position.fromArray(j.xyz);
        origin.quaternion.setFromEuler(rpyEuler(j.rpy));
        var motion = new T.Group();
        origin.add(motion);
        links[parent].add(origin);
        links[j.child] = motion;
        if (j.type === "revolute") joints[j.name] = { obj: motion, axis: new T.Vector3().fromArray(j.axis).normalize(), lower: j.lower, upper: j.upper, q: 0 };
        walk(j.child);
      });
    })("base_link");

    var items = {}, meshes = [];
    var Mx = new T.Matrix4();
    MODEL[kind].forEach(function (it) {
      if (opts.noCables && it.kind === "cable") return;
      if (!GEOM[it.g] || !links[it.link]) return;
      var col, rough = 0.6, metal = 0.02;
      if (it.kind === "printed") col = COLORS[kind];
      else if (it.kind === "motor") { col = COLORS.motor; rough = 0.55; metal = 0.15; }
      else if (it.kind === "screw" || it.kind === "nut") { col = COLORS.steel; rough = 0.32; metal = 0.75; }
      else if (it.kind === "spacer") { col = COLORS.brass; rough = 0.35; metal = 0.7; }
      else if (it.kind === "board") { col = COLORS.board; rough = 0.5; }
      else { col = COLORS.cable; rough = 0.7; }
      var mesh = new T.Mesh(GEOM[it.g], new T.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal }));
      var m = it.m;
      Mx.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1);
      Mx.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.userData = { id: it.id, kind: it.kind, g: it.g, link: it.link, motorId: it.motor || 0, under: it.under, into: it.into, horn: !!it.horn, order: it.order,
        base: mesh.position.clone(), baseQ: mesh.quaternion.clone(), baseColor: col, name: itemName(it), emi: 0 };
      links[it.link].add(mesh);
      items[it.id] = mesh;
      meshes.push(mesh);
    });
    var robot = { kind: kind, group: outer, root: root, links: links, joints: joints, items: items, meshes: meshes, gear: false };
    robot.motor = function (id) { return items["motor" + id]; };
    robot.setGear = function (on) {
      robot.gear = on;
      meshes.forEach(function (mm) {
        if (!mm.userData.motorId) return;
        var c = on ? COLORS["g" + GEAR[kind][mm.userData.motorId]] : COLORS.motor;
        mm.material.color.setHex(c); mm.userData.baseColor = c;
      });
    };
    return robot;
  }

  // 정규화 값(-100~100, 그리퍼 0~100) ↔ 각도(rad). 새 캘리브레이션 기준: 0 = 범위 가운데
  function normToRad(j, name, v) {
    if (name === "gripper") return j.lower + clamp(v, 0, 100) / 100 * (j.upper - j.lower);
    v = clamp(v, -100, 100);
    return v < 0 ? -v / 100 * j.lower : v / 100 * j.upper;
  }
  function radToNorm(j, name, q) {
    if (name === "gripper") return (q - j.lower) / (j.upper - j.lower) * 100;
    return q < 0 ? -q / j.lower * 100 : q / j.upper * 100;
  }
  function setQ(robot, name, q) {
    var j = robot.joints[name];
    if (!j) return;
    j.q = q;
    j.obj.quaternion.setFromAxisAngle(j.axis, q);
  }
  function setPose(robot, pose) { JOINTS.forEach(function (n) { if (pose[n] !== undefined) setQ(robot, n, normToRad(robot.joints[n], n, pose[n])); }); }
  function setPoseRad(robot, pose) { JOINTS.forEach(function (n) { if (pose[n] !== undefined) setQ(robot, n, clamp(pose[n], robot.joints[n].lower, robot.joints[n].upper)); }); }

  /* 뷰어 */
  function makeViewer(stage, opts) {
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(36, 1, 0.005, 10);
    camera.position.fromArray(opts.cam);
    var controls = new T.OrbitControls(camera, renderer.domElement);
    controls.target.fromArray(opts.target);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minDistance = opts.minDist || 0.18; controls.maxDistance = 2.2;
    controls.maxPolarAngle = Math.PI * (opts.maxPolar || 0.52);
    controls.update();
    scene.add(new T.HemisphereLight(0xffffff, 0x6f7a86, 0.75));
    var key = new T.DirectionalLight(0xffffff, 0.8); key.position.set(0.5, 1.0, 0.7); scene.add(key);
    var rim = new T.DirectionalLight(0xffffff, 0.35); rim.position.set(-0.7, 0.5, -0.6); scene.add(rim);
    var under = new T.DirectionalLight(0xffffff, 0.2); under.position.set(0.2, -1, 0.3); scene.add(under);
    var grid = new T.GridHelper(opts.grid || 1.0, 20, 0x8794a0, 0x8794a0);
    grid.material.transparent = true; grid.material.opacity = 0.22; scene.add(grid);
    var v = { renderer: renderer, scene: scene, camera: camera, controls: controls, stage: stage, visible: true, dirty: true, grid: grid };
    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); v.dirty = true;
    }
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage); else window.addEventListener("resize", resize);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { v.visible = e[0].isIntersecting; if (v.visible) v.dirty = true; }).observe(stage);
    controls.addEventListener("change", function () { v.dirty = true; });
    controls.addEventListener("start", function () { v.userMoved = true; v.tween = null; });
    return v;
  }

  // 물체 상자가 화면에 꽉 차도록 카메라 맞추기
  function fitDist(v, r) {
    var fov = v.camera.fov * Math.PI / 180;
    return r / Math.sin(fov / 2) / Math.min(1, v.camera.aspect * 0.95);
  }
  function frame(v, box, dir, pad) {
    var c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    var r = size.length() / 2 * (pad || 1.15);
    v.controls.target.copy(c);
    v.camera.position.copy(c).addScaledVector(new T.Vector3().fromArray(dir).normalize(), fitDist(v, r));
    v.controls.update(); v.dirty = true;
  }
  // 카메라를 부드럽게 옮기기
  function flyTo(v, target, pos, ms) {
    v.tween = { t0: performance.now(), d: reduceMotion ? 1 : (ms || 750), ft: v.controls.target.clone(), fp: v.camera.position.clone(), tt: target.clone(), tp: pos.clone() };
  }
  function tickTween(v, now) {
    var tw = v.tween; if (!tw) return;
    var u = clamp((now - tw.t0) / tw.d, 0, 1), e = u * u * (3 - 2 * u);
    v.controls.target.lerpVectors(tw.ft, tw.tt, e);
    v.camera.position.lerpVectors(tw.fp, tw.tp, e);
    v.dirty = true;
    if (u >= 1) v.tween = null;
  }

  // 마우스를 올리면 부품 이름
  function attachHover(v, getMeshes) {
    var tip = document.createElement("div"); tip.className = "tip3d"; tip.hidden = true; v.stage.appendChild(tip);
    var ray = new T.Raycaster(), mouse = new T.Vector2(), last = null;
    function restore(m) { m.material.emissive.setHex(m.userData.emi || 0); }
    v.renderer.domElement.addEventListener("pointermove", function (e) {
      if (e.buttons) { tip.hidden = true; return; }
      var r = v.renderer.domElement.getBoundingClientRect();
      mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(mouse, v.camera);
      var hit = ray.intersectObjects(getMeshes().filter(function (m) { return m.visible && !m.userData.ghost; }), false)[0];
      var m = hit ? hit.object : null;
      if (last && last !== m) { restore(last); v.dirty = true; }
      if (m) {
        if (last !== m) { m.material.emissive.setHex(0x333333); v.dirty = true; }
        tip.textContent = m.userData.name; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; tip.hidden = false;
      } else tip.hidden = true;
      last = m;
    });
    v.renderer.domElement.addEventListener("pointerleave", function () { tip.hidden = true; if (last) { restore(last); last = null; v.dirty = true; } });
  }

  /* ───────── 3. 조립 순서 (세부 동작) ───────── */
  // 동작: place = 부품이 날아와 끼워짐, screw = 나사가 축 방향으로 돌며 들어감
  // sel: 부품 조건, half: 'hi'/'lo' = 8개를 양쪽 4개씩 나눔, from: 'above' = 위에서 내려옴
  var STEPS = [
    { nav: "전체", title: "완성된 모습", lead: "SO-101은 모터 6개를 받침에서 그리퍼까지 차례로 쌓은 6관절 로봇팔이에요. 리더암과 팔로워암은 뼈대가 같고, 끝부분(그리퍼/핸들)과 모터의 기어비만 달라요.",
      tips: ["<b>다음 단계</b>를 누르면 부품 하나, 나사 하나까지 순서대로 조립되는 모습이 재생돼요.", "회색 나사는 실제 나사 위치예요. 나사가 들어갈 때 카메라가 그쪽으로 다가가요.", "<b>기어비 색</b>을 켜면 모터가 기어비별로 칠해져요. 리더암은 관절마다 색이 달라요."], acts: [] },
    { nav: "받침", title: "받침에 1번 모터 넣기", motor: 1, lead: "받침 회전(shoulder_pan)을 맡는 1번 모터를 받침에 고정해요. 모터 축에는 혼 2개를 미리 끼우고, 위쪽 혼만 가운데 나사로 고정해 둬요(아래 혼은 나사 없음).",
      acts: [
        { t: "받침(베이스)을 평평한 곳에 놓아요.", type: "place", sel: { id: "base_so101_v2" }, from: "above" },
        { t: "1번 모터를 혼이 위를 보게 해서 받침에 넣어요. 3핀 케이블을 미리 하나 꽂아 두면 나중에 편해요.", type: "place", sel: { id: "motor1" }, from: "above" },
        { t: "위쪽에서 M2×6 나사 2개로 모터를 받침에 고정해요.", type: "screw", sel: { kind: "screw", under: "base_so101_v2", into: "motor1" }, half: "hi", xray: true },
        { t: "받침을 뒤집어 아래쪽에서도 M2×6 나사 2개를 박아요.", type: "screw", sel: { kind: "screw", under: "base_so101_v2", into: "motor1" }, half: "lo", xray: true },
        { t: "받침 모터 홀더를 모터 뒤쪽으로 밀어 끼워요.", type: "place", sel: { id: "base_motor_holder_so101_v1" } },
        { t: "홀더 양쪽에 M2×6 나사를 1개씩 박아요.", type: "screw", sel: { kind: "screw", under: "base_motor_holder_so101_v1", into: "base_so101_v2" } }
      ] },
    { nav: "어깨", title: "어깨 부품 올리기", lead: "1번 모터의 혼 위에 어깨 부품(회전대)을 얹어요. 이 부품이 받침 위에서 좌우로 돌아요.",
      acts: [
        { t: "어깨 부품을 1번 모터의 위아래 혼 사이에 맞춰 끼워요.", type: "place", sel: { id: "rotation_pitch_so101_v1" }, from: "above" },
        { t: "위쪽 혼에 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "rotation_pitch_so101_v1" }, half: "hi" },
        { t: "받침을 뒤집어 아래쪽 혼에도 M3×6 나사 4개를 박아요. (받침 안쪽이라 투시로 보여 줘요)", type: "screw", sel: { g: "screw_m3x6", under: "rotation_pitch_so101_v1" }, half: "lo", xray: true },
        { t: "어깨 모터 홀더를 끼워요. 다음 단계의 2번 모터가 여기에 들어가요.", type: "place", sel: { id: "motor_holder_so101_base_v1" } }
      ] },
    { nav: "위팔", title: "2번 모터와 위팔", motor: 2, lead: "어깨를 들어 올리는 2번 모터(shoulder_lift)와 위팔을 달아요. 팔 전체 무게를 버티는 관절이에요.",
      acts: [
        { t: "2번 모터(혼 2개 끼움)를 위에서 밀어 넣어요.", type: "place", sel: { id: "motor2" }, from: "above" },
        { t: "한쪽에서 M2×6 나사 2개로 2번 모터를 고정해요.", type: "screw", sel: { g: "screw_m2x6", into: "motor2" }, half: "hi" },
        { t: "반대쪽에서도 M2×6 나사 2개를 박아요.", type: "screw", sel: { g: "screw_m2x6", into: "motor2" }, half: "lo" },
        { t: "위팔을 2번 모터의 양쪽 혼에 맞춰 끼워요.", type: "place", sel: { id: "upper_arm_so101_v1" } },
        { t: "한쪽 혼에 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "upper_arm_so101_v1" }, half: "hi" },
        { t: "반대쪽 혼에도 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "upper_arm_so101_v1" }, half: "lo" }
      ] },
    { nav: "아래팔", title: "3번 모터와 아래팔", motor: 3, lead: "팔꿈치(elbow_flex)를 굽히는 3번 모터와 아래팔을 달아요.",
      acts: [
        { t: "3번 모터(혼 2개 끼움)를 위팔 끝에 넣어요.", type: "place", sel: { id: "motor3" } },
        { t: "한쪽에서 M2×6 나사 2개로 3번 모터를 고정해요.", type: "screw", sel: { g: "screw_m2x6", link: "upper_arm_link" }, half: "hi" },
        { t: "반대쪽에서도 M2×6 나사 2개를 박아요.", type: "screw", sel: { g: "screw_m2x6", link: "upper_arm_link" }, half: "lo" },
        { t: "아래팔을 3번 모터의 양쪽 혼에 맞춰 끼워요.", type: "place", sel: { id: "under_arm_so101_v1" } },
        { t: "한쪽 혼에 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "under_arm_so101_v1" }, half: "hi" },
        { t: "반대쪽 혼에도 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "under_arm_so101_v1" }, half: "lo" }
      ] },
    { nav: "4번", title: "4번 모터 (손목 굽힘)", motor: 4, lead: "아래팔 끝에 손목을 위아래로 굽히는 4번 모터(wrist_flex)를 달아요.",
      acts: [
        { t: "4번 모터 홀더를 아래팔 끝에 밀어 끼워요.", type: "place", sel: { id: "motor_holder_so101_wrist_v1" } },
        { t: "4번 모터(혼 2개 끼움)를 밀어 넣어요.", type: "place", sel: { id: "motor4" } },
        { t: "한쪽에서 M2×6 나사 2개로 4번 모터를 고정해요.", type: "screw", sel: { g: "screw_m2x6", into: "motor4" }, half: "hi" },
        { t: "반대쪽에서도 M2×6 나사 2개를 박아요.", type: "screw", sel: { g: "screw_m2x6", into: "motor4" }, half: "lo" }
      ] },
    { nav: "손목", title: "5번 모터와 손목", motor: 5, lead: "손목을 비트는 5번 모터(wrist_roll)를 손목 홀더에 넣고, 손목 홀더를 4번 모터에 연결해요.",
      acts: [
        { t: "손목 홀더를 4번 모터 앞에 가져와요.", type: "place", sel: { id: "wrist_roll_pitch_so101_v2" } },
        { t: "5번 모터를 손목 홀더에 넣어요.", type: "place", sel: { id: "motor5" } },
        { t: "앞쪽 M2×6 나사 2개로 5번 모터를 고정해요.", type: "screw", sel: { g: "screw_m2x6", into: "motor5" } },
        { t: "5번 모터에는 혼을 1개만 끼우고, 가운데를 M3×6 나사로 고정해요.", type: "screw", sel: { horn: true } },
        { t: "손목 홀더를 4번 모터의 혼에 맞추고 한쪽에 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "wrist_roll_pitch_so101_v2" }, half: "hi" },
        { t: "반대쪽에도 M3×6 나사 4개를 박아요.", type: "screw", sel: { g: "screw_m3x6", under: "wrist_roll_pitch_so101_v2" }, half: "lo" }
      ] },
    { nav: "그리퍼", navL: "핸들", motor: 6, title: "그리퍼와 6번 모터", titleL: "핸들·트리거와 6번 모터",
      lead: "팔로워암 끝에는 물건을 집는 그리퍼가 달려요. 6번 모터가 움직이는 집게를 여닫아요.",
      leadL: "리더암 끝에는 그리퍼 대신 손잡이(핸들)와 트리거가 달려요. 손가락으로 트리거를 당기면 6번 모터가 돌아 팔로워의 그리퍼가 닫혀요.",
      acts: [
        { t: "그리퍼 몸체를 5번 모터의 혼에 맞춰 올려요.", type: "place", sel: { id: "wrist_roll_follower_so101_v1" } },
        { t: "M3×6 나사 4개로 그리퍼 몸체를 혼에 고정해요.", type: "screw", sel: { g: "screw_m3x6", link: "gripper_link", into: "motor5" } },
        { t: "6번 모터(혼 2개 끼움)를 그리퍼 몸체에 넣어요.", type: "place", sel: { id: "motor6" } },
        { t: "한쪽에서 M2×6 나사 2개로 6번 모터를 고정해요.", type: "screw", sel: { g: "screw_m2x6", into: "motor6" }, half: "hi" },
        { t: "반대쪽에서도 M2×6 나사 2개를 박아요.", type: "screw", sel: { g: "screw_m2x6", into: "motor6" }, half: "lo" },
        { t: "M3 너트 2개를 몸체의 육각 홈에 끼워요.", type: "place", sel: { kind: "nut" }, small: true },
        { t: "움직이는 집게를 6번 모터의 혼에 맞춰 끼워요.", type: "place", sel: { id: "moving_jaw_so101_v1" } },
        { t: "한쪽 혼에 M3×6 나사 4개를 박아요.", type: "screw", sel: { under: "moving_jaw_so101_v1" }, half: "hi" },
        { t: "반대쪽 혼에도 M3×6 나사 4개를 박아요.", type: "screw", sel: { under: "moving_jaw_so101_v1" }, half: "lo" }
      ],
      actsL: [
        { t: "핸들 연결부를 5번 모터의 혼에 맞춰 올려요.", type: "place", sel: { id: "Wrist_Roll_SO101" } },
        { t: "M3×6 나사 4개로 핸들 연결부를 혼에 고정해요.", type: "screw", sel: { g: "screw_m3x6", link: "gripper_link", into: "motor5" } },
        { t: "6번 모터(리더용 1/147)를 넣고 나사로 고정해요.", type: "place", sel: { id: "motor6" } },
        { t: "손잡이(핸들)를 연결부에 고정해요.", type: "place", sel: { id: "Handle_SO101" } },
        { t: "트리거를 6번 모터의 혼에 고정해요. 당겼다 놓았을 때 부드럽게 움직이는지 확인해요.", type: "place", sel: { id: "Trigger_SO101" } }
      ] },
    { nav: "배선", title: "컨트롤러 보드와 케이블", lead: "모터 6개를 3핀 케이블로 한 줄로 이어 보드에 연결해요(데이지 체인).",
      callout: "<strong>전원</strong> 팔로워암 보드에는 12V, 리더암 보드에는 5V 어댑터를 꽂아요.",
      acts: [
        { t: "<b>모터 ID 설정(설명서 5단계)을 먼저 끝낸 뒤</b> 보드 장착판을 받침 뒤쪽에 달아요. ID 설정 때는 모터를 하나씩 따로 연결해야 하기 때문이에요.", type: "place", sel: { id: "waveshare_mounting_plate_so101_v2" } },
        { t: "M2.5 육각 스페이서 4개를 장착판에 세워요.", type: "place", sel: { kind: "spacer" }, small: true },
        { t: "컨트롤러 보드를 스페이서 위에 올려요. Waveshare 보드라면 점퍼 2개를 B 채널(USB)에 꽂아 둬요.", type: "place", sel: { id: "board" } },
        { t: "M2.5×4 나사 4개로 보드를 고정해요.", type: "screw", sel: { g: "screw_m25x4" } },
        { t: "3핀 케이블을 보드 → 1번 → 2번 → … → 6번 순서로 이어요. 관절을 끝까지 움직여 보며 케이블이 끼지 않는지 확인해요.", type: "place", sel: { kind: "cable" }, cable: true }
      ] }
  ];

  function matches(u, sel) {
    for (var k in sel) { if (sel[k] !== u[k]) return false; }
    return true;
  }

  var asm = null;
  var tmpBox = new T.Box3(), tv = new T.Vector3(), tq = new T.Quaternion();
  function worldCenter(meshes) {
    tmpBox.makeEmpty();
    meshes.forEach(function (m) { tmpBox.expandByObject(m); });
    return { c: tmpBox.getCenter(new T.Vector3()), r: Math.max(0.006, tmpBox.getSize(new T.Vector3()).length() / 2) };
  }
  function dirToLink(m, worldDir) { m.parent.getWorldQuaternion(tq); return worldDir.clone().applyQuaternion(tq.invert()).normalize(); }

  // 단계·동작에 부품 배정, 들어오는 방향과 카메라 위치 미리 계산 (조립 화면은 CAD 자세로 고정)
  function makePlan(r) {
    r.group.updateMatrixWorld(true);
    var used = {};
    var whole = worldCenter(r.meshes);
    r.center = whole.c;
    var assembled = [];
    r.plan = STEPS.map(function (s, si) {
      var acts = (r.kind === "leader" && s.actsL) ? s.actsL : s.acts;
      return acts.map(function (a, ai) {
        var ms = r.meshes.filter(function (m) { return !used[m.userData.id] && matches(m.userData, a.sel); });
        if (a.half === "hi") {   // 'lo' 는 남은 것 전부
          var w = ms.map(function (m) { return m.getWorldPosition(new T.Vector3()); });
          var lo = new T.Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
          w.forEach(function (p) { lo.min(p); hi.max(p); });
          var span = hi.clone().sub(lo), ax = span.x >= span.y && span.x >= span.z ? "x" : span.y >= span.z ? "y" : "z";
          var mid = (lo[ax] + hi[ax]) / 2;
          ms = ms.filter(function (m, i) { return w[i][ax] >= mid; });
        }
        if (a.cable) ms.sort(function (x, y) { return x.userData.order - y.userData.order; });
        ms.forEach(function (m, k) {
          used[m.userData.id] = true;
          var u = m.userData; u.s = si; u.a = ai; u.k = k;
          if (a.type === "screw") {
            var info = MODEL.screwInfo[u.g];
            u.axisL = new T.Vector3().fromArray(info.axis);            // 나사 자신의 좌표계 (머리→끝)
            u.axisP = u.axisL.clone().applyQuaternion(u.baseQ);         // 링크 좌표계
            u.drive = info.len + 0.012;
          } else {
            var wc = worldCenter([m]).c, ref = assembled.length ? worldCenter(assembled).c : r.center.clone().setY(0);
            var wd = a.from === "above" ? new T.Vector3(0, 1, 0) : wc.clone().sub(ref);
            if (wd.lengthSq() < 1e-8) wd.set(0, 1, 0);
            wd.normalize(); if (a.from !== "above") wd.y = Math.max(wd.y, 0.25);
            u.flyL = dirToLink(m, wd.normalize());
            u.flyD = a.small ? 0.03 : a.cable ? 0.035 : 0.07;
          }
        });
        assembled = assembled.concat(ms);
        // 카메라
        var wc2 = worldCenter(ms.length ? ms : r.meshes);
        var view = null;
        if (a.type === "screw" && ms.length) {
          var ax = new T.Vector3();
          ms.forEach(function (m) { m.getWorldQuaternion(tq); ax.add(m.userData.axisL.clone().applyQuaternion(tq)); });
          if (ax.length() > ms.length * 0.6) view = ax.normalize().negate();   // 머리 쪽에서 바라보기 (방향이 한쪽일 때만)
        }
        return { meshes: ms, def: a, cam: { c: wc2.c, r: wc2.r, view: view } };
      });
    });
    // 어느 동작에도 안 들어간 부품은 1단계부터 보이게
    r.meshes.forEach(function (m) { if (m.userData.s === undefined) { m.userData.s = 1; m.userData.a = -1; } });
    // 분해 방향: 나사는 붙는 부품과 함께
    var q = new T.Quaternion();
    r.meshes.forEach(function (m) {
      var c = worldCenter([m]).c, d = c.sub(r.center); d.y *= 1.6;
      if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
      m.parent.getWorldQuaternion(q);
      m.userData.dir = d.normalize().applyQuaternion(q.invert());
    });
    r.meshes.forEach(function (m) {
      var host = m.userData.under && r.items[m.userData.under];
      if ((m.userData.kind === "screw" || m.userData.kind === "nut") && host && host.parent === m.parent) m.userData.dir = host.userData.dir;
    });
  }

  function initAssembly() {
    var v = makeViewer($("asm-stage"), { cam: [0.42, 0.36, 0.5], target: [0, 0.16, 0], grid: 0.8, minDist: 0.04, maxPolar: 0.9 });
    asm = { v: v, robots: {}, kind: "follower", step: 0, act: -1, explode: 0, rotate: false, gear: false, follow: true, xray: false, playing: false, anim: null, wait: 0 };
    ["follower", "leader"].forEach(function (k) {
      var r = buildRobot(k);
      setPoseRad(r, MODEL.cadPose);
      setQ(r, "gripper", k === "leader" ? 0.25 : 0.35);
      r.group.visible = k === "follower";
      v.scene.add(r.group);
      asm.robots[k] = r;
      makePlan(r);
    });
    var r0 = asm.robots.follower;
    asm.home = { box: new T.Box3().setFromObject(r0.group), dir: [0.85, 0.5, 0.55] };
    frame(v, asm.home.box, asm.home.dir, 0.95);
    attachHover(v, function () { return asm.robots[asm.kind].meshes; });
    buildStepNav();
    showStep(0);
    $("asm-status").hidden = true;

    $("asm-follower").onclick = function () { setKind("follower"); };
    $("asm-leader").onclick = function () { setKind("leader"); };
    $("asm-gear").onclick = function () {
      asm.gear = !asm.gear; this.setAttribute("aria-pressed", asm.gear);
      $("gear-legend").hidden = !asm.gear;
      asm.robots.follower.setGear(asm.gear); asm.robots.leader.setGear(asm.gear); v.dirty = true;
    };
    $("asm-follow").onclick = function () { asm.follow = !asm.follow; this.setAttribute("aria-pressed", asm.follow); if (asm.follow) aimCamera(); };
    $("asm-xray").onclick = function () { asm.xray = !asm.xray; this.setAttribute("aria-pressed", asm.xray); applyLook(); };
    $("asm-rotate").onclick = function () { asm.rotate = !asm.rotate; this.setAttribute("aria-pressed", asm.rotate); v.controls.autoRotate = asm.rotate; v.controls.autoRotateSpeed = 1.6; };
    $("asm-explode").oninput = function () { asm.explode = this.value / 100; applyPositions(performance.now()); };
    $("btn-prev").onclick = function () { if (asm.step > 0) showStep(asm.step - 1); };
    $("btn-next").onclick = function () { if (asm.step < STEPS.length - 1) showStep(asm.step + 1); };
    document.querySelectorAll("[data-goto-step]").forEach(function (a) {
      a.addEventListener("click", function () { showStep(+a.getAttribute("data-goto-step")); });
    });
  }

  function curPlan() { return asm.robots[asm.kind].plan[asm.step]; }
  function setKind(k) {
    asm.kind = k;
    $("asm-follower").setAttribute("aria-pressed", k === "follower");
    $("asm-leader").setAttribute("aria-pressed", k === "leader");
    asm.robots.follower.group.visible = k === "follower";
    asm.robots.leader.group.visible = k === "leader";
    buildStepNav();
    showStep(asm.step);
  }
  function buildStepNav() {
    var nav = $("steps-nav"); nav.innerHTML = "";
    STEPS.forEach(function (s, i) {
      var b = document.createElement("button"); b.type = "button";
      b.innerHTML = i + "<small>" + esc(asm.kind === "leader" && s.navL ? s.navL : s.nav) + "</small>";
      b.onclick = function () { showStep(i); };
      nav.appendChild(b);
    });
  }
  function motorBadge(id) {
    var name = JOINTS[id - 1];
    var f = GEAR.follower[id], l = GEAR.leader[id];
    return '<div class="motor-badge"><div class="id">' + id + "번<br>" + esc(name) + '</div>' +
      '<div class="' + (asm.kind === "follower" ? "on" : "") + '">팔로워암<br><span class="gr r' + f + '">1/' + f + "</span> 12V</div>" +
      '<div class="' + (asm.kind === "leader" ? "on l" : "") + '">리더암<br><span class="gr r' + l + '">1/' + l + "</span> 7.4V</div></div>";
  }
  function countLabel(meshes) {
    var c = {}, order = [];
    meshes.forEach(function (m) { var n = m.userData.name; if (!c[n]) { c[n] = 0; order.push(n); } c[n]++; });
    return order.map(function (n) { return c[n] > 1 ? n + " ×" + c[n] : n; });
  }

  function showStep(i) {
    asm.step = i;
    var s = STEPS[i], L = asm.kind === "leader";
    var nav = $("steps-nav").children;
    for (var k = 0; k < nav.length; k++) {
      if (k === i) nav[k].setAttribute("aria-current", "step"); else nav[k].removeAttribute("aria-current");
      nav[k].classList.toggle("done", k < i);
    }
    var plan = curPlan();
    var html = '<div class="step-no">' + (i === 0 ? "Overview" : "Step " + i + " / " + (STEPS.length - 1)) + "</div>";
    html += "<h3>" + esc((L && s.titleL) || s.title) + "</h3><p>" + ((L && s.leadL) || s.lead) + "</p>";
    if (s.tips) { html += "<ul>"; s.tips.forEach(function (t) { html += "<li>" + t + "</li>"; }); html += "</ul>"; }
    if (plan.length) {
      html += '<div class="act-bar"><button type="button" id="act-restart" title="처음부터">↺</button><button type="button" id="act-prev" title="이전 동작">◀</button>' +
        '<button type="button" id="act-play" class="play">▶ 재생</button><button type="button" id="act-next" title="다음 동작">▶|</button><span id="act-count"></span></div>';
      html += '<ol class="acts" id="acts">';
      plan.forEach(function (p, ai) {
        var labels = countLabel(p.meshes);
        html += '<li data-a="' + ai + '"><span class="t">' + p.def.t + '</span>' +
          (labels.length ? '<span class="what">' + labels.map(function (x) { return '<i class="' + (p.def.type === "screw" ? "sc" : "") + '">' + esc(x) + "</i>"; }).join("") + "</span>" : "") + "</li>";
      });
      html += "</ol>";
    }
    if (s.motor) html += motorBadge(s.motor);
    if (s.motor && L && GEAR.leader[s.motor] !== 345) html += '<div class="callout"><strong>모터 확인</strong> 이 자리는 리더암 전용 <b>1/' + GEAR.leader[s.motor] + '</b> 모터예요. 팔로워용 1/345 모터를 넣으면 손으로 움직이기 뻑뻑해져요.</div>';
    if (s.motor && !L) html += '<div class="callout"><strong>모터 확인</strong> 팔로워암은 6개 모두 <b>1/345</b> 모터예요. 리더용 모터가 섞이면 그 관절만 힘이 약해 쉽게 밀려요.</div>';
    if (s.callout) html += '<div class="callout">' + s.callout + "</div>";
    if (i > 0 && i < STEPS.length - 1 && s.acts.some(function (a) { return a.type === "screw"; })) html += '<div class="callout info"><strong>나사 구별</strong> M2×6은 가장 작은 나사로 모터를 홀더에 고정할 때, M3×6은 머리가 둥근 조금 큰 나사로 혼에 부품을 고정할 때 써요.</div>';
    $("step-card").innerHTML = html;
    if (plan.length) {
      $("act-play").onclick = function () { if (asm.playing) pause(); else play(); };
      $("act-prev").onclick = function () { pause(); goAct(Math.max(0, asm.act - 1), true); };
      $("act-next").onclick = function () { pause(); if (asm.act < plan.length - 1) goAct(asm.act + 1, true); else finishAct(); };
      $("act-restart").onclick = function () { goAct(0, true); play(true); };
      $("acts").querySelectorAll("li").forEach(function (li) { li.onclick = function () { pause(); goAct(+li.getAttribute("data-a"), true); }; });
    }
    $("btn-prev").disabled = i === 0;
    $("btn-next").disabled = i === STEPS.length - 1;
    asm.anim = null;
    if (i === 0) {
      asm.act = -1; asm.playing = false; refresh();
      if (asm.follow) homeCamera();
    } else {
      goAct(0, !reduceMotion);
      if (!reduceMotion) play(true); else { asm.act = plan.length - 1; refresh(); }
    }
  }
  function homeCamera() {
    var v = asm.v, d = new T.Vector3().fromArray(asm.home.dir).normalize();
    var c = asm.home.box.getCenter(new T.Vector3()), r = asm.home.box.getSize(new T.Vector3()).length() / 2 * 0.95;
    flyTo(v, c, c.clone().addScaledVector(d, fitDist(v, r)));
  }
  function aimCamera() {
    var v = asm.v, plan = curPlan(), p = plan[asm.act];
    if (!p) return;
    var cur = v.camera.position.clone().sub(v.controls.target).normalize();
    var dir = cur.clone();
    if (p.cam.view) dir = p.cam.view.clone().multiplyScalar(0.75).add(cur.multiplyScalar(0.25)).add(new T.Vector3(0, 0.25, 0)).normalize();
    var dist = p.def.type === "screw" ? clamp(fitDist(v, p.cam.r) * 2.3, 0.13, 0.36) : clamp(fitDist(v, p.cam.r) * 1.5, 0.18, 0.6);
    flyTo(v, p.cam.c, p.cam.c.clone().addScaledVector(dir, dist));
  }
  // 동작 시작: done=true 이면 애니메이션 없이 끝난 상태로
  function goAct(ai, animate) {
    asm.act = ai;
    var p = curPlan()[ai];
    asm.anim = animate && p ? { t0: performance.now(), n: p.meshes.length, type: p.def.type } : null;
    refresh();
    if (asm.follow) aimCamera();
  }
  function actDuration(a) {
    if (!a) return 0;
    if (a.type === "screw") return 1100 + (a.n - 1) * 320;
    return a.n > 1 ? 800 + (a.n - 1) * 220 : 950;
  }
  function finishAct() {
    asm.anim = null; refresh();
  }
  function play(fromStart) {
    asm.playing = true; asm.wait = 0;
    var b = $("act-play"); if (b) b.textContent = "⏸ 멈춤";
    if (!fromStart && !asm.anim) { if (asm.act < curPlan().length - 1) goAct(asm.act + 1, true); else { goAct(0, true); } }
  }
  function pause() {
    asm.playing = false;
    var b = $("act-play"); if (b) b.textContent = "▶ 재생";
  }
  function refresh() {
    var r = asm.robots[asm.kind];
    var lis = $("acts") ? $("acts").children : [];
    for (var k = 0; k < lis.length; k++) { lis[k].classList.toggle("on", k === asm.act); lis[k].classList.toggle("done", k < asm.act); }
    var plan = curPlan();
    if ($("act-count")) $("act-count").textContent = (asm.act + 1) + " / " + plan.length;
    var emi = asm.kind === "leader" ? 0x0b2a55 : 0x552008;
    r.meshes.forEach(function (m) {
      var u = m.userData;
      var vis = asm.step === 0 || u.s < asm.step || (u.s === asm.step && u.a <= asm.act);
      m.visible = vis;
      u.cur = asm.step > 0 && u.s === asm.step && u.a === asm.act;
      u.emi = u.cur ? (u.kind === "screw" || u.kind === "nut" || u.kind === "spacer" ? 0x7a3a00 : emi) : 0;
      m.material.emissive.setHex(u.emi);
    });
    applyLook();
    applyPositions(performance.now());
  }
  // 투시: 지금 동작이 아닌 부품을 반투명하게
  function applyLook() {
    var r = asm.robots[asm.kind], p = curPlan()[asm.act];
    var hidden = p && p.def.type === "screw" && p.meshes.length && /^screw_m2x/.test(p.meshes[0].userData.g); // 모터 고정 나사는 홈 안쪽이라 투시로
    var on = asm.xray || !!(p && (p.def.xray || hidden) && asm.step > 0);
    var keep = {};
    if (p) p.meshes.forEach(function (m) { if (m.userData.into) keep[m.userData.into] = true; });
    r.meshes.forEach(function (m) {
      var ghost = on && !m.userData.cur && !keep[m.userData.id] && asm.step > 0;
      m.userData.ghost = ghost;
      m.material.transparent = ghost; m.material.opacity = ghost ? 0.18 : 1; m.material.depthWrite = !ghost;
      m.renderOrder = ghost ? 1 : 0;
      m.material.needsUpdate = true;
    });
    asm.v.dirty = true;
  }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  var spinQ = new T.Quaternion();
  function applyPositions(now) {
    var r = asm.robots[asm.kind], e = asm.explode * 0.075;
    var a = asm.anim, el = a ? now - a.t0 : 0;
    r.meshes.forEach(function (m) {
      var u = m.userData;
      if (!m.visible) return;
      m.position.copy(u.base);
      m.quaternion.copy(u.baseQ);
      if (e && u.dir) m.position.addScaledVector(u.dir, e);
      if (!a || !u.cur) return;
      if (a.type === "screw") {
        var p = clamp((el - u.k * 320) / 1100, 0, 1), w = ease(p);
        m.position.addScaledVector(u.axisP, -u.drive * (1 - w));
        spinQ.setFromAxisAngle(u.axisL, (1 - w) * Math.PI * 8);
        m.quaternion.multiply(spinQ);
      } else {
        var p2 = clamp((el - u.k * 220) / (a.n > 1 ? 800 : 950), 0, 1);
        m.position.addScaledVector(u.flyL, u.flyD * (1 - ease(p2)));
      }
    });
    asm.v.dirty = true;
  }
  function tickAssembly(now) {
    if (!asm) return;
    var v = asm.v;
    tickTween(v, now);
    if (asm.anim) {
      applyPositions(now);
      if (now - asm.anim.t0 > actDuration(asm.anim)) { asm.anim = null; applyPositions(now); asm.wait = now; }
    } else if (asm.playing && asm.step > 0 && asm.wait && now - asm.wait > 550) {
      asm.wait = 0;
      if (asm.act < curPlan().length - 1) goAct(asm.act + 1, true); else pause();
    }
    v.controls.update();
    if (v.visible && (v.dirty || asm.rotate)) { v.renderer.render(v.scene, v.camera); v.dirty = false; }
  }

  /* ───────── 4. 연동 시뮬레이션 ───────── */
  var REST = { shoulder_pan: 0, shoulder_lift: -100, elbow_flex: 100, wrist_flex: 60, wrist_roll: 0, gripper: 2 };
  var MID = { shoulder_pan: 0, shoulder_lift: 0, elbow_flex: 0, wrist_flex: 0, wrist_roll: 0, gripper: 50 };
  var DEMO = [
    [0, MID], [1.2, { shoulder_pan: 35, shoulder_lift: 10, elbow_flex: -10, wrist_flex: 55, wrist_roll: 0, gripper: 90 }],
    [2.4, { shoulder_pan: 35, shoulder_lift: 35, elbow_flex: -25, wrist_flex: 60, wrist_roll: 0, gripper: 90 }],
    [3.1, { shoulder_pan: 35, shoulder_lift: 35, elbow_flex: -25, wrist_flex: 60, wrist_roll: 0, gripper: 8 }],
    [4.1, { shoulder_pan: 35, shoulder_lift: 0, elbow_flex: 0, wrist_flex: 40, wrist_roll: 0, gripper: 8 }],
    [5.6, { shoulder_pan: -40, shoulder_lift: 0, elbow_flex: 0, wrist_flex: 40, wrist_roll: 40, gripper: 8 }],
    [6.6, { shoulder_pan: -40, shoulder_lift: 30, elbow_flex: -20, wrist_flex: 60, wrist_roll: 40, gripper: 8 }],
    [7.3, { shoulder_pan: -40, shoulder_lift: 30, elbow_flex: -20, wrist_flex: 60, wrist_roll: 40, gripper: 90 }],
    [8.5, MID]
  ];
  var FAULTS = {
    none: { h: "정상", p: ["리더암을 움직이면 팔로워암이 거의 바로 따라와요. 리더암을 아주 빠르게 움직이면 아주 살짝 늦는데, 떨림을 막으려고 일부러 부드럽게 움직이게 해 둔 것이라 정상이에요.", "<b>팔로워 손으로 밀어 보기</b>를 누르면 모든 관절이 단단히 버텨요."] },
    weak: { h: "팔로워암 1번 자리에 리더용 모터(1/191)가 들어감", p: ["겉모양이 같아 헷갈리기 쉬워요. 기어비가 작은 모터는 힘(토크)이 약해서, 밀면 그 관절만 쉽게 밀려요. <b>기어비 색</b>을 켜면 1번 모터 색이 다른 걸 볼 수 있어요.", "해결: 모터 스티커를 확인해 1/345 모터로 바꾸고, 그 팔의 모터 ID 설정과 캘리브레이션을 다시 해요. <a href=\"#motor-table\">모터 구분표</a>"] },
    v5: { h: "팔로워암에 5V 어댑터를 꽂음", p: ["12V용 모터에 5V가 들어가면 힘과 속도가 크게 줄어요. 그래서 리더암보다 한참 늦게, 느리게 따라오고 밀면 잘 밀려요.", "해결: 팔로워암에는 12V(5A 이상) 어댑터. 어댑터 스티커의 OUTPUT 전압을 확인해요."] },
    narrow: { h: "캘리브레이션 때 1번 관절을 끝까지 안 돌림", p: ["캘리브레이션에서 받침을 조금만 돌리면 MIN과 MAX가 거의 같게 저장돼요. 그러면 프로그램은 그 좁은 범위를 -100~100으로 생각해서, 화면 숫자는 리더와 같아도 실제로는 거의 안 움직여요.", "해결: 같은 이름으로 캘리브레이션을 다시 실행해 <code>c</code>를 누르고, 받침을 양 끝까지 돌려요. 위쪽 <b>캘리브레이션 연습</b> 탭에서 연습할 수 있어요."] },
    cable: { h: "3번과 4번 모터 사이 케이블이 빠짐", p: ["모터는 줄줄이 이어져 있어서 중간이 빠지면 그 뒤의 4·5·6번을 모두 못 찾아요. 프로그램은 시작할 때 6개가 다 있는지 확인하고, 없으면 <code>Missing motor IDs</code> 오류를 내고 멈춰요.", "읽는 법: 찾은 모터 목록이 1·2·3번까지라면 <b>3번 다음 케이블</b>을 확인해요. 목록이 비어 있으면 전원·포트·점퍼, 1번만 있으면 모터 ID 설정 문제예요."] }
  };

  var sim = null;
  function initSim() {
    var v = makeViewer($("sim-stage"), { cam: [0, 0.42, 0.78], target: [0, 0.15, 0], grid: 1.0 });
    sim = { v: v, mode: "teleop", fault: "none", leader: buildRobot("leader", { noCables: true }), follower: buildRobot("follower", { noCables: true }),
      lv: Object.assign({}, MID), fq: {}, fqv: {}, push: 0, pushT0: -1, demoT0: -1, labels: {}, termT: 0 };
    sim.leader.group.position.set(-0.24, 0, 0);
    sim.follower.group.position.set(0.24, 0, 0);
    v.scene.add(sim.leader.group); v.scene.add(sim.follower.group);
    setPose(sim.leader, sim.lv);
    setPose(sim.follower, sim.lv);
    JOINTS.forEach(function (n) { sim.fq[n] = sim.follower.joints[n].q; sim.fqv[n] = 0; });
    sim.arrow = new T.ArrowHelper(new T.Vector3(-1, 0, 0), new T.Vector3(0.36, 0.2, 0.0), 0.1, 0xD2622A, 0.03, 0.02);
    sim.arrow.visible = false; v.scene.add(sim.arrow);
    ["leader", "follower"].forEach(function (k) {
      var el = document.createElement("div"); el.className = "stage-label";
      el.style.background = k === "leader" ? "var(--lead)" : "var(--follow)";
      el.textContent = k === "leader" ? "리더암 (손으로)" : "팔로워암 (따라 함)";
      v.stage.appendChild(el); sim.labels[k] = el;
    });
    attachHover(v, function () { return sim.leader.meshes.concat(sim.follower.meshes); });
    v.scene.updateMatrixWorld(true);
    sim.frameTeleop = function () {
      setPose(sim.leader, MID); setPose(sim.follower, MID); v.scene.updateMatrixWorld(true);
      var b = new T.Box3().setFromObject(sim.leader.group).union(new T.Box3().setFromObject(sim.follower.group));
      setPose(sim.leader, sim.lv);
      frame(v, b, [0.55, 0.42, 0.8], 0.92);
    };
    sim.frameCal = function () {
      setPose(sim.leader, MID); v.scene.updateMatrixWorld(true);
      frame(v, new T.Box3().setFromObject(sim.leader.group), [0.75, 0.45, 0.65], 1.05);
    };
    sim.frameTeleop();
    buildJointSliders();
    $("sim-status").hidden = true;

    $("pose-mid").onclick = function () { stopDemo(); setLeader(MID); };
    $("pose-rest").onclick = function () { stopDemo(); setLeader(REST); };
    $("pose-demo").onclick = function () { if (sim.demoT0 >= 0) stopDemo(); else { sim.demoT0 = performance.now(); this.textContent = "시연 멈추기 ■"; } };
    $("sim-push").onclick = function () { sim.pushT0 = performance.now(); };
    $("sim-gear").onclick = function () {
      var on = this.getAttribute("aria-pressed") !== "true"; this.setAttribute("aria-pressed", on);
      sim.leader.setGear(on); sim.follower.setGear(on); sim.follower.setFaultGear(); v.dirty = true;
    };
    sim.follower.setFaultGear = function () {
      var m = sim.follower.meshes.filter(function (x) { return x.userData.motorId === 1; })[0];
      if (sim.follower.gear && sim.fault === "weak") { m.material.color.setHex(COLORS.g191); }
      else m.material.color.setHex(sim.follower.gear ? COLORS.g345 : COLORS.motor);
    };
    document.querySelectorAll('#faults input[name="fault"]').forEach(function (r) {
      r.addEventListener("change", function () { if (r.checked) setFault(r.value); });
    });
    document.querySelectorAll("[data-fault]").forEach(function (a) {
      a.addEventListener("click", function () {
        var f = a.getAttribute("data-fault"); selectTab("teleop");
        var inp = document.querySelector('#faults input[value="' + f + '"]'); inp.checked = true; setFault(f);
      });
    });
    $("tab-teleop").onclick = function () { selectTab("teleop"); };
    $("tab-cal").onclick = function () { selectTab("cal"); };
    document.querySelectorAll("[data-sim-tab]").forEach(function (a) { a.addEventListener("click", function () { selectTab(a.getAttribute("data-sim-tab")); }); });
    $("cal-enter").onclick = calEnter;
    $("cal-reset").onclick = function () { calStart(); };
    updateTerm = updateTermImpl;
    setFault("none");
  }

  function buildJointSliders() {
    var box = $("lead-joints"); box.innerHTML = "";
    sim.sliders = {};
    JOINTS.forEach(function (n, i) {
      var g = n === "gripper";
      var row = document.createElement("div"); row.className = "joint";
      row.innerHTML = '<span class="jid">' + (i + 1) + '</span><span class="jname">' + JK[n] + "<small>" + n + '</small></span><span class="jval"></span>' +
        '<input type="range" min="' + (g ? 0 : -100) + '" max="100" step="1" aria-label="' + JK[n] + '">';
      var inp = row.querySelector("input");
      inp.value = sim.lv[n];
      inp.addEventListener("input", function () { stopDemo(); sim.lv[n] = +inp.value; refreshSliders(); });
      sim.sliders[n] = { inp: inp, val: row.querySelector(".jval") };
      box.appendChild(row);
    });
    refreshSliders();
  }
  function refreshSliders() {
    JOINTS.forEach(function (n) {
      var s = sim.sliders[n];
      if (+s.inp.value !== Math.round(sim.lv[n])) s.inp.value = Math.round(sim.lv[n]);
      s.val.textContent = (sim.lv[n] >= 0 && n !== "gripper" ? "+" : "") + Math.round(sim.lv[n]);
    });
    sim.v.dirty = true;
  }
  function setLeader(p) { sim.anim = { from: Object.assign({}, sim.lv), to: p, t0: performance.now(), d: 700 }; }
  function stopDemo() { if (sim.demoT0 >= 0) { sim.demoT0 = -1; $("pose-demo").textContent = "집기 시연 ▶"; } sim.anim = null; }
  function setFault(f) {
    sim.fault = f;
    var x = FAULTS[f];
    $("fault-explain").innerHTML = '<div class="step-no">무슨 일이 생긴 걸까?</div><h3 style="font-size:19px;margin:4px 0 8px">' + esc(x.h) + "</h3>" + x.p.map(function (t) { return "<p>" + t + "</p>"; }).join("");
    sim.follower.setFaultGear();
    $("fault-explain").querySelectorAll('a[href="#motor-table"]').forEach(function (a) { a.addEventListener("click", function () { openStep("m5"); }); });
    updateTerm(true);
  }
  function selectTab(t) {
    sim.mode = t;
    $("tab-teleop").setAttribute("aria-selected", t === "teleop");
    $("tab-cal").setAttribute("aria-selected", t === "cal");
    $("pane-teleop").hidden = t !== "teleop";
    $("pane-cal").hidden = t !== "cal";
    sim.follower.group.visible = t === "teleop";
    sim.labels.follower.hidden = t !== "teleop";
    $("sim-push").hidden = t !== "teleop";
    sim.leader.group.position.x = t === "teleop" ? -0.24 : 0;
    stopDemo();
    if (t === "cal") { sim.frameCal(); calStart(); } else { sim.frameTeleop(); updateTerm(true); }
    sim.v.dirty = true;
  }

  // 팔로워 목표 각도(캘리브레이션 고장 반영)
  function followerTarget(n) {
    var j = sim.follower.joints[n];
    if (sim.fault === "narrow" && n === "shoulder_pan") return clamp(sim.lv[n], -100, 100) / 100 * 0.07;
    return normToRad(j, n, sim.lv[n]);
  }
  function followerNorm(n) {
    var j = sim.follower.joints[n];
    if (sim.fault === "narrow" && n === "shoulder_pan") return sim.fq[n] / 0.07 * 100;
    return radToNorm(j, n, sim.fq[n]);
  }

  function tickSim(now, dt) {
    if (!sim) return;
    var v = sim.v, moved = false;
    // 리더 자세 애니메이션
    if (sim.demoT0 >= 0) {
      var t = (now - sim.demoT0) / 1000, k = 0;
      var end = DEMO[DEMO.length - 1][0];
      if (t > end) { stopDemo(); }
      else {
        while (k < DEMO.length - 2 && DEMO[k + 1][0] < t) k++;
        var a = DEMO[k], b = DEMO[k + 1], u = (t - a[0]) / (b[0] - a[0]);
        u = u * u * (3 - 2 * u);
        JOINTS.forEach(function (n) { sim.lv[n] = lerp(a[1][n], b[1][n], u); });
        refreshSliders(); moved = true;
      }
    } else if (sim.anim) {
      var u2 = clamp((now - sim.anim.t0) / sim.anim.d, 0, 1), e2 = u2 * u2 * (3 - 2 * u2);
      JOINTS.forEach(function (n) { sim.lv[n] = lerp(sim.anim.from[n], sim.anim.to[n], e2); });
      refreshSliders(); moved = true;
      if (u2 >= 1) sim.anim = null;
    }
    if (sim.mode === "cal") { calTick(); if (moved || v.dirty) renderSim(); return; }
    setPose(sim.leader, sim.lv);

    // 밀기 교란
    var push = 0;
    if (sim.pushT0 >= 0) {
      var pt = (now - sim.pushT0) / 1600;
      if (pt >= 1) { sim.pushT0 = -1; push = 0; } else push = Math.sin(Math.PI * pt);
    }
    sim.arrow.visible = push > 0.02;
    if (sim.arrow.visible) {
      var aw = new T.Vector3(); sim.follower.links.upper_arm_link.getWorldPosition(aw);
      sim.arrow.position.set(aw.x + 0.13, aw.y + 0.02, aw.z);
      sim.arrow.setLength(0.06 + push * 0.05, 0.025, 0.018);
    }

    // 팔로워 역학 (2차 시스템 + 속도 제한)
    var cableDead = sim.fault === "cable";
    var wn = sim.fault === "v5" ? 3.2 : 16, vmax = sim.fault === "v5" ? 0.6 : 4.5;
    var h = Math.min(dt, 0.05);
    JOINTS.forEach(function (n) {
      if (cableDead) return;
      var target = followerTarget(n);
      var acc = wn * wn * (target - sim.fq[n]) - 2 * wn * sim.fqv[n];
      sim.fqv[n] = clamp(sim.fqv[n] + acc * h, -vmax, vmax);
      sim.fq[n] += sim.fqv[n] * h;
      var j = sim.follower.joints[n];
      var comp = 0;
      if (n === "shoulder_pan") comp = sim.fault === "weak" ? 0.75 : sim.fault === "v5" ? 0.35 : 0.03;
      else if (n === "shoulder_lift" || n === "elbow_flex") comp = sim.fault === "v5" ? 0.12 : 0.01;
      setQ(sim.follower, n, sim.fq[n] + push * comp);
      j.q = sim.fq[n];
    });
    if (now - sim.termT > 120) { sim.termT = now; updateTerm(false, push > 0.02); }
    renderSim();
  }
  var tmpV = new T.Vector3();
  function renderSim() {
    var v = sim.v;
    v.controls.update();
    if (!v.visible) return;
    v.renderer.render(v.scene, v.camera);
    v.dirty = false;
    var w = v.stage.clientWidth, hgt = v.stage.clientHeight;
    ["leader", "follower"].forEach(function (k) {
      var r = sim[k], el = sim.labels[k];
      tmpV.set(r.group.position.x, 0, 0.09).project(v.camera);
      el.style.left = ((tmpV.x + 1) / 2 * w) + "px";
      el.style.top = ((1 - tmpV.y) / 2 * hgt + 6) + "px";
    });
  }

  function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
  function lpad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }
  function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function updateTermImpl(force, pushing) {
    if (!sim) return;
    if (sim.mode === "cal") { calTerm(); return; }
    readMine();
    var P = '<span class="p">(lerobot) C:\\Users\\student&gt;</span>';
    var cmd = "lerobot-teleoperate --robot.type=so101_follower --robot.port=" + esc(my.fport) + " --robot.id=" + esc(my.fid) + " --teleop.type=so101_leader --teleop.port=" + esc(my.lport) + " --teleop.id=" + esc(my.lid) + " --display_data=true";
    var out = P + cmd + "\n";
    if (sim.fault === "cable") {
      out += '<span class="e">RuntimeError: FeetechMotorsBus motor check failed on port \'' + esc(my.fport) + "':\n\nMissing motor IDs:\n  - 4 (expected model: 777)\n  - 5 (expected model: 777)\n  - 6 (expected model: 777)</span>\n\n" +
        "Full expected motor list (id: model_number):\n{1: 777, 2: 777, 3: 777, 4: 777, 5: 777, 6: 777}\n\nFull found motor list (id: model_number):\n" +
        '<span class="h">{1: 777, 2: 777, 3: 777}</span>   ← 3번 다음이 끊김\n\n' + P;
    } else {
      out += '<span class="h">' + pad("NAME", 18) + "|" + lpad("LEADER", 9) + " |" + lpad("FOLLOWER", 9) + "</span>\n";
      JOINTS.forEach(function (n) {
        out += pad(n + ".pos", 18) + "|" + lpad(fmt(sim.lv[n]), 9) + " |" + lpad(fmt(followerNorm(n)), 9) + "\n";
      });
      out += "\ntime: 16.67ms (60 Hz)" + (pushing ? '   <span class="e">← 팔로워암을 손으로 미는 중</span>' : "");
    }
    $("term").innerHTML = out;
  }

  /* ───────── 5. 캘리브레이션 연습 ───────── */
  var cal = null;
  function rawTicks(q) { return Math.round(2048 + q / (2 * Math.PI) * 4096); }
  function calStart() {
    cal = { s: 0, v: {}, min: {}, max: {}, report: null };
    JOINTS.forEach(function (n) {
      cal.v[n] = n === "gripper" ? Math.round(10 + Math.random() * 80) : Math.round((Math.random() * 2 - 1) * 70);
    });
    buildCalSliders();
    calShow();
  }
  function calQ(n) { return normToRad(sim.leader.joints[n], n, cal.v[n]); }
  function buildCalSliders() {
    var box = $("cal-joints"); box.innerHTML = "";
    cal.rows = {};
    JOINTS.forEach(function (n, i) {
      var g = n === "gripper";
      var row = document.createElement("div"); row.className = "joint";
      row.innerHTML = '<span class="jid">' + (i + 1) + '</span><span class="jname">' + JK[n] + "<small>" + n + '</small></span><span class="jval"></span>' +
        '<input type="range" min="' + (g ? 0 : -100) + '" max="100" step="1" aria-label="' + JK[n] + '"><span></span><div class="bar" style="grid-column:2"><i></i></div>';
      var inp = row.querySelector("input"); inp.value = cal.v[n];
      inp.addEventListener("input", function () { cal.v[n] = +inp.value; calTrack(); calShow(); });
      cal.rows[n] = { inp: inp, val: row.querySelector(".jval"), bar: row.querySelector(".bar i"), barBox: row.querySelector(".bar") };
      box.appendChild(row);
    });
  }
  function calTrack() {
    if (cal.s !== 2) return;
    JOINTS.forEach(function (n) {
      if (n === "wrist_roll") return;
      var t = rawTicks(calQ(n));
      cal.min[n] = Math.min(cal.min[n], t); cal.max[n] = Math.max(cal.max[n], t);
    });
  }
  function fullTicks(n) { var j = sim.leader.joints[n]; return [rawTicks(j.lower), rawTicks(j.upper)]; }
  function coverage(n) { var f = fullTicks(n); return (cal.max[n] - cal.min[n]) / (f[1] - f[0]); }
  function calShow() {
    var steps = $("cal-steps").children;
    for (var i = 0; i < steps.length; i++) { steps[i].classList.toggle("on", i === cal.s); steps[i].classList.toggle("done", i < cal.s); }
    JOINTS.forEach(function (n) {
      var r = cal.rows[n];
      r.val.textContent = rawTicks(calQ(n));
      r.inp.disabled = cal.s === 0 || cal.s === 3;
      var show = cal.s >= 2 && n !== "wrist_roll";
      r.barBox.style.visibility = show ? "visible" : "hidden";
      if (show) {
        var f = fullTicks(n), L = f[1] - f[0];
        r.bar.style.left = ((cal.min[n] - f[0]) / L * 100) + "%";
        r.bar.style.width = Math.max(1, (cal.max[n] - cal.min[n]) / L * 100) + "%";
        r.bar.style.background = coverage(n) >= 0.85 ? "var(--ok)" : "var(--lead)";
      }
    });
    var msg = [
      "<b>Enter 누르기</b>로 캘리브레이션 명령을 실행해요.",
      "모든 관절을 범위의 <b>가운데</b>로 옮기고(그리퍼는 반쯤 벌림) Enter를 눌러요.",
      "관절을 <b>하나씩</b> 양 끝까지 움직여요. 막대가 초록이 되면 충분해요. 손목 회전은 자동이라 건너뛰어요. 다 했으면 Enter.",
      cal.report || ""
    ][cal.s];
    if (cal.s === 1 && cal.warn) msg += '<br><span style="color:var(--warn)">' + cal.warn + "</span>";
    $("cal-msg").innerHTML = msg;
    $("cal-enter").textContent = cal.s === 3 ? "다시 해 보기" : "Enter 누르기";
    setPose(sim.leader, cal.v);
    sim.v.dirty = true;
    calTerm();
  }
  function calEnter() {
    if (cal.s === 0) { cal.s = 1; }
    else if (cal.s === 1) {
      var off = JOINTS.filter(function (n) { return n === "gripper" ? Math.abs(cal.v[n] - 50) > 20 : Math.abs(cal.v[n]) > 15; });
      if (off.length) { cal.warn = "가운데에서 먼 관절: " + off.map(function (n) { return JK[n]; }).join(", ") + ". 실제 프로그램은 확인 없이 넘어가지만, 가운데가 아니면 기준이 어긋나요. 맞추고 다시 Enter."; calShow(); return; }
      cal.warn = null; cal.s = 2;
      JOINTS.forEach(function (n) { var t = rawTicks(calQ(n)); cal.min[n] = t; cal.max[n] = t; });
    } else if (cal.s === 2) {
      var low = JOINTS.filter(function (n) { return n !== "wrist_roll" && coverage(n) < 0.85; });
      cal.s = 3;
      cal.report = low.length
        ? '<span style="color:var(--warn)"><b>저장은 됐지만</b> ' + low.map(function (n) { return JK[n] + "(" + Math.round(coverage(n) * 100) + "%)"; }).join(", ") +
          "을(를) 끝까지 안 움직였어요.</span> 연동하면 이 관절은 리더암을 끝까지 움직여도 팔로워암이 덜 움직여요. 실제로는 다시 실행해 <code>c</code>를 누르고 다시 해요."
        : '<span style="color:var(--ok)"><b>잘했어요!</b></span> 모든 관절을 끝까지 움직였어요. 실제 로봇에서도 이렇게 하면 돼요.';
    } else { calStart(); return; }
    calShow();
  }
  function calTick() { /* 슬라이더 이벤트로 갱신 */ }
  function calTerm() {
    if (!cal) return;
    readMine();
    var P = '<span class="p">(lerobot) C:\\Users\\student&gt;</span>';
    var out = P + (cal.s === 0 ? "" : "lerobot-calibrate --teleop.type=so101_leader --teleop.port=" + esc(my.lport) + " --teleop.id=" + esc(my.lid)) + "\n";
    if (cal.s >= 1) out += "Running calibration of " + esc(my.lid) + " SO101Leader\nMove " + esc(my.lid) + " SO101Leader to the middle of its range of motion and press ENTER....";
    if (cal.s >= 2) {
      out += "\nMove all joints except 'wrist_roll' sequentially through their entire ranges of motion.\nRecording positions. Press ENTER to stop...\n\n";
      out += '<span class="h">' + pad("NAME", 15) + "|" + lpad("MIN", 7) + " |" + lpad("POS", 7) + " |" + lpad("MAX", 7) + "</span>\n";
      JOINTS.forEach(function (n) {
        if (n === "wrist_roll") return;
        out += pad(n, 15) + "|" + lpad(cal.min[n], 7) + " |" + lpad(rawTicks(calQ(n)), 7) + " |" + lpad(cal.max[n], 7) + "\n";
      });
    }
    if (cal.s >= 3) out += "\nCalibration saved to C:\\Users\\student\\.cache\\huggingface\\lerobot\\calibration\\teleoperators\\so101_leader\\" + esc(my.lid) + ".json\n" + P;
    $("term").innerHTML = out;
  }

  /* ───────── 6. 로딩과 루프 ───────── */
  var lastT = performance.now();
  function loop(now) {
    var dt = (now - lastT) / 1000; lastT = now;
    tickAssembly(now);
    tickSim(now, dt);
    requestAnimationFrame(loop);
  }

  function loadBin() {
    if ("DecompressionStream" in window) {
      return fetch("model/so101.bin.gz").then(function (r) {
        if (!r.ok || !r.body) throw new Error(r.status);
        return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      }).catch(function () { return fetch("model/so101.bin").then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }); });
    }
    return fetch("model/so101.bin").then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
  }
  Promise.all([
    fetch("model/so101.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
    loadBin()
  ]).then(function (res) {
    MODEL = res[0];
    decode(res[1], MODEL);
    initAssembly();
    initSim();
    if (/[?&]debug/.test(location.search)) window.SO101 = { asm: asm, sim: sim };
    requestAnimationFrame(loop);
  }).catch(function (err) {
    var msg = "3D 모델을 불러오지 못했어요 (" + esc(err && err.message || err) + "). 파일을 직접 연 경우에는 웹 주소로 열어 주세요.";
    ["asm-status", "sim-status"].forEach(function (id) { $(id).innerHTML = msg; $(id).hidden = false; });
    if (window.console) console.error(err);
  });
})();
