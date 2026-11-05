/*!
 * effects.js — vanilla JavaScript ports of the React Bits components used on this site.
 *
 * Ported from React Bits (https://github.com/DavidHDev/react-bits) at commit
 * 4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4:
 *   Backgrounds/DotGrid, TextAnimations/SplitText, TextAnimations/ScrollReveal,
 *   TextAnimations/CountUp, Components/SpotlightCard, Animations/Magnet,
 *   Components/TiltedCard, TextAnimations/VariableProximity, Animations/TargetCursor
 * The React hooks were replaced with plain functions that take a DOM element; the motion
 * math is kept from the originals. SplitText and ScrollReveal use GSAP, like the originals.
 * CountUp's "count" mode uses a GSAP tween instead of motion/react's animate().
 *
 * React Bits: Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
 * Full license text: assets/vendor/react-bits/LICENSE.md
 */
(function (global) {
  "use strict";

  const reduced = () => !!global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const clamp01 = (v) => clamp(v, 0, 1);

  /* ======================================================================
   * DotGrid (Backgrounds/DotGrid) — WebGL2 spring-field dot grid
   * ==================================================================== */
  const DOT_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aMotion;
layout(location = 2) in vec2 aState;
uniform vec2 uResolution;
uniform float uSize;
uniform float uSwell;
uniform float uStretch;
uniform float uGlow;
out vec2 vLocal;
out vec2 vPoint;
out float vLength;
out float vRadius;
out float vEnergy;
void main() {
  float energy = aState.x;
  float radius = 0.5 * uSize * aState.y * (1.0 + uSwell * energy);
  float speed = length(aMotion.zw);
  float angle = speed > 0.001 ? atan(aMotion.w, aMotion.z) : 0.0;
  float axis = floor(angle / 1.5707963 + 0.5) * 1.5707963;
  angle = axis + (angle - axis) * smoothstep(8.0, 70.0, speed);
  vec2 dir = vec2(cos(angle), sin(angle));
  float halfLength = min(uSize * 2.0, speed * uStretch * 0.02);
  float pad = radius * (1.0 + uGlow * energy * 2.5) + 2.0;
  vec2 local = aCorner * vec2(halfLength + pad, pad);
  vec2 point = aMotion.xy + dir * local.x + vec2(-dir.y, dir.x) * local.y;
  vLocal = local;
  vPoint = point;
  vLength = halfLength;
  vRadius = radius;
  vEnergy = energy;
  vec2 clip = point / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

  const DOT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vPoint;
in float vLength;
in float vRadius;
in float vEnergy;
uniform vec2 uResolution;
uniform vec3 uBase;
uniform vec3 uActive;
uniform float uGlow;
uniform float uOpacity;
uniform float uFade;
uniform int uShape;
out vec4 outColor;
float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
void main() {
  float d;
  if (uShape == 1) {
    float corner = vRadius * 0.3;
    vec2 q = abs(vLocal) - vec2(vLength + vRadius, vRadius) + corner;
    d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
  } else {
    d = length(vec2(max(abs(vLocal.x) - vLength, 0.0), vLocal.y)) - vRadius;
  }
  float aa = max(fwidth(d), 0.0001);
  float body = clamp(0.5 - d / aa, 0.0, 1.0);
  float halo = uGlow * vEnergy * 0.5 * exp(-max(d, 0.0) / max(vRadius * 1.3, 0.6));
  float alpha = body + (1.0 - body) * halo;
  vec3 color = mix(uBase, uActive, clamp(vEnergy * 1.2, 0.0, 1.0));
  float fade = 1.0;
  if (uFade > 0.0) {
    vec2 edge = min(vPoint, uResolution - vPoint) / (uFade * 0.4 * min(uResolution.x, uResolution.y));
    fade = smootherstep01(edge.x) * smootherstep01(edge.y);
  }
  alpha *= uOpacity * fade;
  outColor = vec4(color * alpha, alpha);
}
`;

  const toRgb = (color) => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
    if (!match) return [1, 1, 1];
    const hex = match[1].length === 3 ? match[1].replace(/./g, (d) => d + d) : match[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  };
  const smootherstep = (t) => {
    const x = clamp01(t);
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  const backOut = (t) => {
    const s = 1.9;
    const x = t - 1;
    return 1 + x * x * ((s + 1) * x + s);
  };
  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  function dotGrid(canvas, options) {
    const s = Object.assign(
      {
        dotSize: 5, gap: 18, baseColor: "#3a3446", activeColor: "#ffffff", proximity: 140,
        strength: 1, bounce: 0.6, tension: 0.4, returnDuration: 0.8, shockRadius: 320,
        shockStrength: 5, swell: 0.8, stretch: 0.5, glow: 0.5, shape: "circle", fade: 0,
        opacity: 1, intro: true, mouseInteraction: true, clickShock: true, dpr: undefined,
      },
      options
    );
    if (!canvas) return null;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, DOT_VERTEX));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, DOT_FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

    const uniforms = {};
    ["uResolution", "uSize", "uSwell", "uStretch", "uGlow", "uBase", "uActive", "uOpacity", "uFade", "uShape"].forEach(
      (name) => { uniforms[name] = gl.getUniformLocation(program, name); }
    );

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    const isReduced = reduced();
    const view = { width: 0, height: 0, left: 0, top: 0, ratio: 1 };
    const grid = { count: 0, cols: 1, rows: 1, cell: 1, centerX: 0, centerY: 0, reach: 1 };
    let rest = new Float32Array(0);
    let offset = new Float32Array(0);
    let velocity = new Float32Array(0);
    let force = new Float32Array(0);
    let next = new Float32Array(0);
    let wave = new Float32Array(0);
    let energy = new Float32Array(0);
    let instances = new Float32Array(0);
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, time: 0, inside: false, presence: 0 };
    const shocks = [];
    let introStart = s.intro && !isReduced ? -1 : null;
    let visible = true;
    let raf = 0;
    let last = 0;

    const rebuild = () => {
      const size = s.dotSize;
      const spacing = s.gap;
      const cell = Math.max(2, size + spacing);
      const cols = Math.max(1, Math.floor((view.width + spacing) / cell));
      const rows = Math.max(1, Math.floor((view.height + spacing) / cell));
      const startX = (view.width - (cols * cell - spacing)) / 2 + size / 2;
      const startY = (view.height - (rows * cell - spacing)) / 2 + size / 2;
      const count = cols * rows;
      rest = new Float32Array(count * 2);
      offset = new Float32Array(count * 2);
      velocity = new Float32Array(count * 2);
      force = new Float32Array(count * 2);
      next = new Float32Array(count * 2);
      wave = new Float32Array(count * 4);
      energy = new Float32Array(count);
      instances = new Float32Array(count * 6);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = (row * cols + col) * 2;
          rest[index] = startX + col * cell;
          rest[index + 1] = startY + row * cell;
        }
      }
      Object.assign(grid, {
        count, cols, rows, cell,
        centerX: view.width / 2,
        centerY: view.height / 2,
        reach: Math.hypot(view.width, view.height) / 2,
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
    };

    const step = (dt, now) => {
      const motion = isReduced ? 0 : 1;
      const zeta = 1 - 0.85 * clamp01(s.bounce);
      const omega = 4 / (zeta * Math.max(0.2, s.returnDuration));
      const stiffness = omega * omega;
      const damping = 2 * zeta * omega;
      const radius = Math.max(1, s.proximity);
      const speed = Math.hypot(pointer.vx, pointer.vy);
      const drive = s.mouseInteraction && pointer.inside ? 6500 * Math.tanh(speed / 900) * s.strength * motion : 0;
      const dirX = speed > 0.001 ? pointer.vx / speed : 0;
      const dirY = speed > 0.001 ? pointer.vy / speed : 0;
      const width = grid.cell * 1.4;
      const travel = 650;
      const active = shocks.map((shock) => {
        const front = ((now - shock.start) / 1000) * travel;
        const power = smootherstep(1 - front / Math.max(1, s.shockRadius));
        return Object.assign({}, shock, { front, amplitude: power * s.shockStrength * grid.cell * 0.24 * motion });
      });
      const coupling = (Math.max(0, s.tension) * 900) ** 2 / (grid.cell * grid.cell);
      const viscosity = Math.sqrt(coupling) * 0.06;
      const limit = Math.sqrt(stiffness + 8 * coupling) + damping + 8 * viscosity;
      const steps = Math.min(24, Math.max(1, Math.ceil(dt / Math.min(1 / 120, 1.2 / limit))));
      const h = dt / steps;
      for (let i = 0; i < grid.count; i++) {
        const index = i * 2;
        const rx = rest[index];
        const ry = rest[index + 1];
        let ax = 0;
        let ay = 0;
        if (drive > 0) {
          const ex = rx + offset[index] - pointer.x;
          const ey = ry + offset[index + 1] - pointer.y;
          const distance = Math.hypot(ex, ey);
          if (distance < radius) {
            const weight = smootherstep(1 - distance / radius) * drive;
            const nx = distance > 0.001 ? ex / distance : 0;
            const ny = distance > 0.001 ? ey / distance : 0;
            ax += weight * (dirX + nx * 0.6);
            ay += weight * (dirY + ny * 0.6);
          }
        }
        let wx = 0, wy = 0, wvx = 0, wvy = 0;
        for (const shock of active) {
          if (shock.amplitude <= 0) continue;
          const ex = rx - shock.x;
          const ey = ry - shock.y;
          const distance = Math.hypot(ex, ey);
          const u = (distance - shock.front) / width;
          if (Math.abs(u) < 3 && distance > 0.001) {
            const nx = ex / distance;
            const ny = ey / distance;
            const profile = Math.exp(-u * u);
            const push = shock.amplitude * profile;
            const rate = ((shock.amplitude * 2 * u * profile) / width) * travel;
            wx += nx * push;
            wy += ny * push;
            wvx += nx * rate;
            wvy += ny * rate;
            ax += nx * push * stiffness * 0.35;
            ay += ny * push * stiffness * 0.35;
          }
        }
        force[index] = ax;
        force[index + 1] = ay;
        const target = i * 4;
        wave[target] = wx;
        wave[target + 1] = wy;
        wave[target + 2] = wvx;
        wave[target + 3] = wvy;
      }
      const { cols, rows } = grid;
      const stride = cols * 2;
      for (let n = 0; n < steps; n++) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const index = (row * cols + col) * 2;
            let ax = force[index] - stiffness * offset[index] - damping * velocity[index];
            let ay = force[index + 1] - stiffness * offset[index + 1] - damping * velocity[index + 1];
            if (coupling > 0) {
              let lx = -4 * offset[index];
              let ly = -4 * offset[index + 1];
              let mx = -4 * velocity[index];
              let my = -4 * velocity[index + 1];
              if (col > 0) { lx += offset[index - 2]; ly += offset[index - 1]; mx += velocity[index - 2]; my += velocity[index - 1]; }
              if (col < cols - 1) { lx += offset[index + 2]; ly += offset[index + 3]; mx += velocity[index + 2]; my += velocity[index + 3]; }
              if (row > 0) { lx += offset[index - stride]; ly += offset[index - stride + 1]; mx += velocity[index - stride]; my += velocity[index - stride + 1]; }
              if (row < rows - 1) { lx += offset[index + stride]; ly += offset[index + stride + 1]; mx += velocity[index + stride]; my += velocity[index + stride + 1]; }
              ax += coupling * lx + viscosity * mx;
              ay += coupling * ly + viscosity * my;
            }
            next[index] = velocity[index] + ax * h;
            next[index + 1] = velocity[index + 1] + ay * h;
          }
        }
        for (let i = 0; i < offset.length; i++) {
          velocity[i] = next[i];
          offset[i] += velocity[i] * h;
        }
      }
      for (let i = 0; i < grid.count; i++) {
        const index = i * 2;
        const target = i * 4;
        energy[i] = Math.min(
          1,
          (Math.hypot(velocity[index] + wave[target + 2], velocity[index + 1] + wave[target + 3]) / 380) * 0.85 +
            (Math.hypot(offset[index] + wave[target], offset[index + 1] + wave[target + 1]) / (grid.cell * 2.2)) * 0.35
        );
      }
      for (let i = shocks.length - 1; i >= 0; i--) {
        if (active[i].front > s.shockRadius + width * 3) shocks.splice(i, 1);
      }
      const decay = 1 - Math.exp(-dt / 0.08);
      pointer.vx -= pointer.vx * decay;
      pointer.vy -= pointer.vy * decay;
      const presenceTarget = s.mouseInteraction && pointer.inside ? 1 : 0;
      pointer.presence += (presenceTarget - pointer.presence) * (1 - Math.exp(-dt / 0.2));
    };

    const render = (now) => {
      const radius = Math.max(1, s.proximity);
      const introAge = introStart === null ? Infinity : introStart < 0 ? 0 : (now - introStart) / 1000;
      const introFront = introAge * grid.reach * 1.25;
      const introBand = grid.cell * 4;
      for (let i = 0; i < grid.count; i++) {
        const index = i * 2;
        const source = i * 4;
        const x = rest[index] + offset[index] + wave[source];
        const y = rest[index + 1] + offset[index + 1] + wave[source + 1];
        let glowing = energy[i];
        if (pointer.presence > 0.001) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          if (distance < radius) glowing = Math.max(glowing, smootherstep(1 - distance / radius) * 0.4 * pointer.presence);
        }
        let scale = 1;
        if (introStart !== null) {
          const distance = Math.hypot(rest[index] - grid.centerX, rest[index + 1] - grid.centerY);
          const appear = clamp01((introFront - distance) / introBand);
          scale = appear >= 1 ? 1 : Math.max(0, backOut(appear));
          glowing = Math.max(glowing, Math.sin(appear * Math.PI) * 0.6);
        }
        const target = i * 6;
        instances[target] = x;
        instances[target + 1] = y;
        instances[target + 2] = velocity[index] + wave[source + 2];
        instances[target + 3] = velocity[index + 1] + wave[source + 3];
        instances[target + 4] = glowing;
        instances[target + 5] = scale;
      }
      const base = toRgb(s.baseColor);
      const accent = toRgb(s.activeColor);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniform2f(uniforms.uResolution, view.width, view.height);
      gl.uniform1f(uniforms.uSize, Math.max(0.5, s.dotSize));
      gl.uniform1f(uniforms.uSwell, isReduced ? 0 : Math.max(0, s.swell));
      gl.uniform1f(uniforms.uStretch, isReduced ? 0 : Math.max(0, s.stretch));
      gl.uniform1f(uniforms.uGlow, Math.max(0, s.glow));
      gl.uniform3f(uniforms.uBase, base[0], base[1], base[2]);
      gl.uniform3f(uniforms.uActive, accent[0], accent[1], accent[2]);
      gl.uniform1f(uniforms.uOpacity, clamp01(s.opacity));
      gl.uniform1f(uniforms.uFade, clamp01(s.fade));
      gl.uniform1i(uniforms.uShape, s.shape === "square" ? 1 : 0);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, grid.count);
      gl.bindVertexArray(null);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(s.dpr != null ? s.dpr : global.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      Object.assign(view, { width, height, left: rect.left, top: rect.top, ratio });
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      rebuild();
      render(performance.now());
    };

    const settled = (now) => {
      if (shocks.length) return false;
      if (introStart !== null) {
        if (introStart < 0 || (now - introStart) / 1000 < 1.6) return false;
        introStart = null;
      }
      if (Math.abs(pointer.vx) + Math.abs(pointer.vy) > 1) return false;
      const presenceTarget = s.mouseInteraction && pointer.inside ? 1 : 0;
      if (Math.abs(presenceTarget - pointer.presence) > 0.002) return false;
      for (let i = 0; i < offset.length; i++) {
        if (Math.abs(offset[i]) > 0.02 || Math.abs(velocity[i]) > 0.5) return false;
      }
      return true;
    };

    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      if (introStart !== null && introStart < 0) introStart = now;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt, now);
      render(now);
      if (!settled(now)) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const locate = (event) => {
      const rect = canvas.getBoundingClientRect();
      view.left = rect.left;
      view.top = rect.top;
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    const onMove = (event) => {
      if (!s.mouseInteraction) return;
      const [x, y] = locate(event);
      const inside = x >= 0 && y >= 0 && x <= view.width && y <= view.height;
      const time = event.timeStamp || performance.now();
      if (inside && pointer.inside && pointer.time) {
        const elapsed = Math.max(4, time - pointer.time) / 1000;
        const vx = (x - pointer.x) / elapsed;
        const vy = (y - pointer.y) / elapsed;
        pointer.vx += (vx - pointer.vx) * 0.6;
        pointer.vy += (vy - pointer.vy) * 0.6;
      } else {
        pointer.vx = 0;
        pointer.vy = 0;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.time = time;
      if (inside !== pointer.inside || inside) {
        pointer.inside = inside;
        wake();
      }
    };
    const onLeave = () => { pointer.inside = false; pointer.time = 0; wake(); };
    const onOut = (event) => { if (!event.relatedTarget) onLeave(); };
    const onDown = (event) => {
      if (!s.clickShock || isReduced) return;
      const [x, y] = locate(event);
      if (x < 0 || y < 0 || x > view.width || y > view.height) return;
      shocks.push({ x, y, start: performance.now() });
      if (shocks.length > 6) shocks.shift();
      wake();
    };

    global.addEventListener("pointermove", onMove, { passive: true });
    global.addEventListener("pointerdown", onDown, { passive: true });
    global.addEventListener("pointerout", onOut);
    global.addEventListener("blur", onLeave);

    const resizeObserver = new ResizeObserver(() => { resize(); wake(); });
    resizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    visibilityObserver.observe(canvas);
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    wake();

    return {
      destroy() {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        global.removeEventListener("pointermove", onMove);
        global.removeEventListener("pointerdown", onDown);
        global.removeEventListener("pointerout", onOut);
        global.removeEventListener("blur", onLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        gl.deleteBuffer(cornerBuffer);
        gl.deleteBuffer(instanceBuffer);
        gl.deleteVertexArray(vao);
        gl.deleteProgram(program);
      },
    };
  }

  /* ======================================================================
   * SplitText (TextAnimations/SplitText) — GSAP SplitText reveal on view/load
   * Default "rise" effect: from { opacity: 0, y: 40 } to { opacity: 1, y: 0 }, power3.out.
   * ==================================================================== */
  function splitText(el, options) {
    const o = Object.assign(
      {
        splitType: "chars", delay: 50, duration: 1.25, ease: "power3.out",
        from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 },
        threshold: 0.1, rootMargin: "-100px", staggerFrom: "start",
        mask: false, trigger: "view", startDelay: 0, revert: true, onComplete: null,
      },
      options
    );
    const gsap = global.gsap;
    const GSAPSplitText = global.SplitText;
    if (!el || !gsap || !GSAPSplitText || reduced()) return null;

    const startPct = (1 - o.threshold) * 100;
    const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(o.rootMargin);
    const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
    const marginUnit = marginMatch ? marginMatch[2] || "px" : "px";
    const sign =
      marginValue === 0 ? "" : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`;
    const start = `top ${startPct}%${sign}`;
    const unit = o.splitType.includes("chars") ? "chars" : o.splitType.includes("words") ? "words" : "lines";

    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    const split = new GSAPSplitText(el, {
      type: o.splitType,
      smartWrap: true,
      mask: o.mask ? unit : undefined,
      linesClass: "split-line",
      wordsClass: "split-word",
      charsClass: "split-char",
      aria: "auto",
    });
    el.setAttribute("aria-label", label);
    const pieces = split[unit];
    gsap.set(el, { opacity: 1 });

    const tl = gsap.timeline({
      delay: o.trigger === "load" ? o.startDelay : 0,
      scrollTrigger: o.trigger === "view" ? { trigger: el, start, once: true, fastScrollEnd: true } : undefined,
      onComplete: () => {
        if (o.revert) split.revert();
        if (o.onComplete) o.onComplete();
      },
    });
    tl.fromTo(
      pieces,
      Object.assign({}, o.from, { willChange: "transform, opacity" }),
      Object.assign({}, o.to, {
        duration: o.duration,
        ease: o.ease,
        stagger: gsap.utils.distribute({ each: o.delay / 1000, from: o.staggerFrom }),
      }),
      0
    );
    tl.set(pieces, { clearProps: "willChange" });
    return { timeline: tl, split };
  }

  /* ======================================================================
   * ScrollReveal (TextAnimations/ScrollReveal) — scrubbed word reveal
   * ==================================================================== */
  const SCRUB_SPAN = 0.5;
  const easeOut3 = (v) => 1 - Math.pow(1 - v, 3);
  const clampToScroll = (p) => (typeof p === "string" && !p.startsWith("clamp(") ? `clamp(${p})` : p);

  const paintPiece = (piece, t, look) => {
    let reveal = t;
    let fadeIn = t;
    let motion = "";
    if (look.effect === "rise") {
      reveal = easeOut3(t);
      fadeIn = clamp01(reveal * 1.25);
      if (reveal < 1) motion = `translateY(${((1 - reveal) * 0.8).toFixed(3)}em)`;
    }
    const settle = clamp01(reveal);
    const lift = look.offset * (1 - settle);
    piece.style.opacity = t >= 1 ? "" : (look.baseOpacity + (1 - look.baseOpacity) * fadeIn).toFixed(3);
    piece.style.transform = [lift ? `translateY(${lift.toFixed(2)}px)` : "", motion].filter(Boolean).join(" ");
    piece.style.filter = look.blur && settle < 1 ? `blur(${(look.blur * (1 - settle)).toFixed(2)}px)` : "";
  };

  function scrollReveal(el, options) {
    const o = Object.assign(
      {
        enableBlur: true, baseOpacity: 0.1, baseRotation: 3, blurStrength: 4, baseOffset: 0,
        stagger: 0.05, smoothing: 0, effect: "fade",
        rotationEnd: "bottom bottom", wordAnimationEnd: "bottom bottom",
      },
      options
    );
    const gsap = global.gsap;
    const ScrollTrigger = global.ScrollTrigger;
    if (!el || !gsap || !ScrollTrigger || reduced()) return null;

    // Split the paragraph's text into word spans (whitespace kept as text nodes).
    const text = el.textContent;
    el.textContent = "";
    const pieces = [];
    text.split(/(\s+)/).forEach((part) => {
      if (part.trim() === "") {
        if (part) el.appendChild(document.createTextNode(part));
        return;
      }
      const word = document.createElement("span");
      word.className = "scroll-reveal-word";
      const piece = document.createElement("span");
      piece.className = "scroll-reveal-piece";
      piece.textContent = part;
      word.appendChild(piece);
      el.appendChild(word);
      pieces.push(piece);
    });

    const look = {
      effect: o.effect,
      baseOpacity: o.baseOpacity,
      blur: o.enableBlur ? o.blurStrength : 0,
      offset: o.baseOffset,
    };
    const state = { p: 0 };
    const last = pieces.map(() => -1);
    const gap = Math.max(0, o.stagger);
    const total = () => SCRUB_SPAN + Math.max(0, pieces.length - 1) * gap;
    const render = () => {
      const at = state.p * total();
      pieces.forEach((piece, index) => {
        const t = clamp01((at - index * gap) / SCRUB_SPAN);
        if (t === last[index]) return;
        last[index] = t;
        paintPiece(piece, t, look);
      });
    };
    pieces.forEach((piece) => {
      piece.style.willChange = pieces.length > 80 ? "" : o.effect === "fade" && !o.baseOffset ? "opacity" : "opacity, transform";
    });
    render();

    const scrub = o.smoothing > 0 ? o.smoothing : true;
    if (o.baseRotation) {
      gsap.fromTo(
        el,
        { transformOrigin: "0% 50%", rotate: o.baseRotation },
        { ease: "none", rotate: 0, scrollTrigger: { trigger: el, start: "top bottom", end: clampToScroll(o.rotationEnd), scrub } }
      );
    }
    gsap.to(state, {
      p: 1,
      ease: "none",
      onUpdate: render,
      scrollTrigger: {
        trigger: el,
        start: () => `top bottom-=${0.2 * Math.min(el.offsetHeight, global.innerHeight)}`,
        end: clampToScroll(o.wordAnimationEnd),
        scrub,
      },
    });
    return { pieces };
  }

  /* ======================================================================
   * CountUp (TextAnimations/CountUp, "count" mode) — counts to the element's own text
   * The final text is restored verbatim when the count finishes.
   * ==================================================================== */
  const decimalPlaces = (str) => {
    const parts = String(str).split(".");
    return parts[1] && parseInt(parts[1], 10) !== 0 ? parts[1].length : 0;
  };

  function countUp(el, options) {
    const o = Object.assign({ from: 0, duration: 2, delay: 0, start: "top 92%" }, options);
    const gsap = global.gsap;
    const ScrollTrigger = global.ScrollTrigger;
    if (!el || !gsap || !ScrollTrigger || reduced()) return null;
    const finalText = el.textContent.trim();
    const match = /^([^\d]*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(finalText);
    if (!match) return null;
    const prefix = match[1];
    const raw = match[2];
    const suffix = match[3];
    const separator = raw.includes(",") ? "," : "";
    const to = parseFloat(raw.replace(/,/g, ""));
    const places = Math.max(decimalPlaces(o.from), decimalPlaces(raw.replace(/,/g, "")));
    const format = (value) => {
      const fixed = Math.abs(value).toFixed(places);
      const [int, frac] = fixed.split(".");
      const grouped = separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : int;
      return `${prefix}${grouped}${frac ? `.${frac}` : ""}${suffix}`;
    };

    // Screen readers get the final value; the counting digits are hidden from them.
    el.textContent = "";
    const srText = document.createElement("span");
    srText.className = "sr-only";
    srText.textContent = finalText;
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.textContent = format(o.from);
    el.append(srText, visual);

    const state = { v: o.from };
    ScrollTrigger.create({
      trigger: el,
      start: o.start,
      once: true,
      onEnter: () => {
        gsap.to(state, {
          v: to,
          duration: o.duration,
          delay: o.delay,
          ease: "power2.out", // cubic-bezier(0.33, 1, 0.68, 1), React Bits' easeOut
          onUpdate: () => { visual.textContent = format(state.v); },
          onComplete: () => { el.textContent = finalText; },
        });
      },
    });
    return { finalText };
  }

  /* ======================================================================
   * SpotlightCard (Components/SpotlightCard) — pointer/focus-following light
   * ==================================================================== */
  const SPOT_THEMES = {
    dark: { light: "#ffffff", fill: 1, edge: 1 },
    light: { light: "#18181b", fill: 0.28, edge: 0.7 },
  };

  const falloff = (color, softness) => {
    const soft = clamp01(softness);
    const core = (1 - soft) ** 1.5 * 0.85;
    const stop = (alpha, at) =>
      `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(2)}%, transparent) ${(at * 100).toFixed(2)}%`;
    const list = [stop(1, 0)];
    for (let i = 0; i <= 14; i++) {
      const t = core + ((1 - core) * i) / 14;
      const g = (t - core) / (1 - core);
      const smooth = 1 - g * g * (3 - 2 * g);
      const glow = Math.exp(-4.6 * g * g) * (1 - g ** 6);
      list.push(stop(smooth + (glow - smooth) * soft, t));
    }
    return list.join(", ");
  };

  function spotlightCard(root, options) {
    const o = Object.assign(
      { intensity: 0.15, spotlightSize: 240, softness: 0.7, borderGlow: 0.6, proximity: 80, smoothing: 0.3, flare: true, theme: "dark" },
      options
    );
    if (!root || !(global.CSS && CSS.supports && CSS.supports("color", "color-mix(in srgb, red 50%, transparent)"))) return null;
    const palette = SPOT_THEMES[o.theme] || SPOT_THEMES.dark;
    const color = o.spotlightColor || palette.light;
    const s = {
      fill: falloff(color, o.softness),
      edge: falloff(color, 1),
      size: Math.max(20, o.spotlightSize),
      intensity: clamp01(o.intensity) * palette.fill,
      borderGlow: clamp01(o.borderGlow) * palette.edge,
      proximity: Math.max(0, o.proximity),
      smoothing: clamp01(o.smoothing),
      flare: o.flare,
    };

    root.classList.add("spotlight-card");
    const make = (cls) => {
      const span = document.createElement("span");
      span.className = cls;
      span.setAttribute("aria-hidden", "true");
      return span;
    };
    const light = make("spotlight-card__light");
    const border = make("spotlight-card__border");
    const edge = make("spotlight-card__edge");
    root.prepend(light);
    root.append(border, edge);

    const reduce = reduced();
    const state = { x: 0, y: 0, presence: 0, flare: 0, pressed: false };
    const pointer = { x: 0, y: 0, active: false };
    const drawn = { light: "", edge: "" };
    let focus = null;
    let raf = 0;
    let last = 0;

    const gradient = (size, x, y, stops) =>
      `radial-gradient(circle ${size.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, ${stops})`;

    const paint = () => {
      const size = s.size * (1 + 0.2 * state.flare);
      const boost = 1 + 0.7 * state.flare;
      const fill = gradient(size, state.x, state.y, s.fill);
      const rim = gradient(size * 0.6, state.x, state.y, s.edge);
      if (fill !== drawn.light) { drawn.light = fill; light.style.background = fill; }
      if (rim !== drawn.edge) { drawn.edge = rim; edge.style.background = rim; }
      light.style.opacity = String(Math.min(1, state.presence * s.intensity * boost));
      edge.style.opacity = String(Math.min(1, state.presence * s.borderGlow * boost));
    };

    const tick = (now) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const rect = root.getBoundingClientRect();
      let tx = state.x;
      let ty = state.y;
      let target = 0;
      if (focus && root.contains(focus)) {
        const box = focus.getBoundingClientRect();
        tx = box.left + box.width / 2 - rect.left;
        ty = box.top + box.height / 2 - rect.top;
        target = 1;
      } else if (pointer.active) {
        tx = pointer.x - rect.left;
        ty = pointer.y - rect.top;
        const gapX = Math.max(0, -tx, tx - rect.width);
        const gapY = Math.max(0, -ty, ty - rect.height);
        const gap = Math.hypot(gapX, gapY);
        if (gap === 0) target = 1;
        else if (s.proximity > 0) target = Math.max(0, 1 - gap / s.proximity) ** 2;
      }
      if (state.presence < 0.02 && target > 0) { state.x = tx; state.y = ty; }
      const follow = reduce || s.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (0.015 + s.smoothing * 0.22));
      state.x += (tx - state.x) * follow;
      state.y += (ty - state.y) * follow;
      const fade = reduce ? 1 : 1 - Math.exp(-dt / (target > state.presence ? 0.1 : 0.32));
      state.presence += (target - state.presence) * fade;
      if (Math.abs(target - state.presence) < 0.002) state.presence = target;
      const press = state.pressed && s.flare && !reduce ? 1 : 0;
      state.flare += (press - state.flare) * (1 - Math.exp(-dt / (press ? 0.05 : 0.28)));
      if (Math.abs(press - state.flare) < 0.002) state.flare = press;
      paint();
      const moving = Math.abs(tx - state.x) > 0.1 || Math.abs(ty - state.y) > 0.1;
      const settledNow = !moving && state.presence === target && state.flare === press;
      if (!settledNow) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    let near = false;
    const onMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      const rect = root.getBoundingClientRect();
      const isNear =
        event.clientX > rect.left - s.proximity && event.clientX < rect.right + s.proximity &&
        event.clientY > rect.top - s.proximity && event.clientY < rect.bottom + s.proximity;
      if (isNear || near || state.presence > 0) wake();
      near = isNear;
    };
    const onOut = (event) => { if (event.relatedTarget) return; pointer.active = false; wake(); };
    const onDown = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      state.pressed = true;
      wake();
    };
    const onUp = (event) => {
      if (event.pointerType !== "mouse") pointer.active = false;
      if (!state.pressed && event.pointerType === "mouse") return;
      state.pressed = false;
      wake();
    };
    const onFocusIn = (event) => {
      if (!(event.target instanceof Element) || !event.target.matches(":focus-visible")) return;
      focus = event.target;
      wake();
    };
    const onFocusOut = (event) => {
      if (root.contains(event.relatedTarget)) return;
      focus = null;
      wake();
    };
    const onScroll = () => { if (pointer.active || state.presence > 0) wake(); };

    global.addEventListener("pointermove", onMove, { passive: true });
    global.addEventListener("pointerup", onUp);
    global.addEventListener("pointercancel", onUp);
    global.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerout", onOut);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    paint();
    return { root };
  }

  /* ======================================================================
   * Magnet (Animations/Magnet) — spring pull toward the pointer
   * Measures the element's untransformed box, so no wrapper element is needed.
   * ==================================================================== */
  const smoothstepRange = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  function magnet(el, options) {
    const o = Object.assign(
      { padding: 100, magnetStrength: 2, maxOffset: undefined, stiffness: 170, damping: 16, mass: 1 },
      options
    );
    if (!el || reduced()) return null;
    if (global.matchMedia && !global.matchMedia("(hover: hover) and (pointer: fine)").matches) return null;
    const strength = Math.max(0.1, o.magnetStrength);
    const current = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    let pointer = null;
    let raf = 0;
    let last = 0;

    const measure = () => {
      const target = { x: 0, y: 0 };
      if (!pointer) return target;
      const rect = el.getBoundingClientRect();
      const left = rect.left - current.x;
      const top = rect.top - current.y;
      const dx = pointer.x - (left + rect.width / 2);
      const dy = pointer.y - (top + rect.height / 2);
      const outside = Math.hypot(Math.max(0, Math.abs(dx) - rect.width / 2), Math.max(0, Math.abs(dy) - rect.height / 2));
      if (outside > o.padding) return target;
      const pull = o.padding > 0 ? 1 - smoothstepRange(o.padding * 0.5, o.padding, outside) : 1;
      let x = (dx / strength) * pull;
      let y = (dy / strength) * pull;
      if (o.maxOffset != null) {
        const length = Math.hypot(x, y);
        if (length > o.maxOffset) { x *= o.maxOffset / length; y *= o.maxOffset / length; }
      }
      target.x = x;
      target.y = y;
      return target;
    };

    const frame = (now) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const target = measure();
      const steps = Math.ceil(dt / (1 / 120));
      let resting = true;
      for (let i = 0; i < steps; i++) {
        resting = true;
        ["x", "y"].forEach((key) => {
          const force = o.stiffness * (target[key] - current[key]) - o.damping * velocity[key];
          velocity[key] += (force / o.mass) * (dt / steps);
          current[key] += velocity[key] * (dt / steps);
          if (Math.abs(target[key] - current[key]) > 0.05 || Math.abs(velocity[key]) > 0.05) resting = false;
        });
      }
      if (resting) {
        current.x = target.x; current.y = target.y;
        velocity.x = 0; velocity.y = 0;
      }
      el.style.transform = current.x || current.y ? `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)` : "";
      if (!resting) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

    global.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      wake();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { pointer = null; wake(); });
    global.addEventListener("blur", () => { pointer = null; wake(); });
    return { el };
  }

  /* ======================================================================
   * TiltedCard (Components/TiltedCard) — spring 3D tilt toward the pointer, lift and glare
   * The pointer is measured on `frame` (untransformed); the tilt is applied to `body`.
   * ==================================================================== */
  const springStep = (state, key, target, omega, zeta, dt) => {
    const v = `v${key}`;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      state[v] += (omega * omega * (target - state[key]) - 2 * zeta * omega * state[v]) * h;
      state[key] += state[v] * h;
    }
    const settled = Math.abs(target - state[key]) < 0.001 && Math.abs(state[v]) < 0.01;
    if (settled) { state[key] = target; state[v] = 0; }
    return !settled;
  };

  function tiltedCard(frame, body, options) {
    const o = Object.assign({ rotateAmplitude: 12, scaleOnHover: 1.05, smoothness: 0.6, glare: 0.5 }, options);
    if (!frame || !body || reduced()) return null;
    if (global.matchMedia && !global.matchMedia("(hover: hover) and (pointer: fine)").matches) return null;
    const amplitude = clamp(o.rotateAmplitude, 0, 60);
    const omega = 20 * Math.pow(0.2, clamp01(o.smoothness));
    const zeta = 1 - 0.3 * clamp01(o.smoothness);
    const state = { rx: 0, vrx: 0, ry: 0, vry: 0, lift: 0, vlift: 0 };
    const pointer = { nx: 0, ny: 0, inside: false };
    let focused = false;
    let raf = 0;
    let last = 0;

    const glare = document.createElement("span");
    glare.className = "tilt-glare";
    glare.setAttribute("aria-hidden", "true");
    body.appendChild(glare);

    const tick = (now) => {
      raf = 0;
      const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
      last = now;
      const engaged = pointer.inside;
      let busy = false;
      busy = springStep(state, "rx", engaged ? -pointer.ny * amplitude : 0, omega, zeta, dt) || busy;
      busy = springStep(state, "ry", engaged ? pointer.nx * amplitude : 0, omega, zeta, dt) || busy;
      busy = springStep(state, "lift", engaged || focused ? 1 : 0, omega, Math.max(zeta, 0.85), dt) || busy;
      const scale = 1 + (o.scaleOnHover - 1) * state.lift;
      const resting = !state.rx && !state.ry && scale === 1;
      body.style.transform = resting ? "" :
        `perspective(1000px) rotateX(${state.rx.toFixed(3)}deg) rotateY(${state.ry.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
      const reach = Math.max(amplitude, 1);
      body.style.setProperty("--tc-gx", `${(50 + (state.ry / reach) * 46).toFixed(2)}%`);
      body.style.setProperty("--tc-gy", `${(50 - (state.rx / reach) * 46).toFixed(2)}%`);
      const energy = Math.min(1, Math.hypot(state.rx, state.ry) / reach);
      body.style.setProperty("--tc-glare", (o.glare * Math.max(state.lift * 0.5, energy)).toFixed(3));
      if (busy) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const track = (event) => {
      const rect = frame.getBoundingClientRect();
      pointer.nx = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1);
      pointer.ny = clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1);
    };
    frame.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse" && e.pointerType !== "pen") return; pointer.inside = true; track(e); wake(); });
    frame.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" && e.pointerType !== "pen") return; pointer.inside = true; track(e); wake(); });
    frame.addEventListener("pointerleave", () => { pointer.inside = false; wake(); });
    frame.addEventListener("focusin", (e) => { focused = e.target.matches && e.target.matches(":focus-visible"); wake(); });
    frame.addEventListener("focusout", () => { focused = false; wake(); });
    return { frame };
  }

  /* ======================================================================
   * VariableProximity (TextAnimations/VariableProximity) — letters change font-variation
   * settings (and color) by distance from the pointer. Text content is unchanged: letters
   * are wrapped in spans and the heading keeps an aria-label with the original text.
   * ==================================================================== */
  const GAUSSIAN_EDGE = Math.exp(-2);
  const parseAxes = (settings) =>
    new Map(settings.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const [name, value] = p.split(/\s+/);
      return [name.replace(/['"]/g, ""), parseFloat(value)];
    }));
  const strengthAt = (distance, radius, falloff) => {
    if (distance >= radius) return 0;
    const norm = 1 - distance / radius;
    if (falloff === "exponential") return norm * norm;
    if (falloff === "gaussian") return (Math.exp(-2 * (distance / radius) ** 2) - GAUSSIAN_EDGE) / (1 - GAUSSIAN_EDGE);
    return norm;
  };

  function variableProximity(el, options) {
    const o = Object.assign(
      {
        fromFontVariationSettings: "'wght' 400", toFontVariationSettings: "'wght' 700",
        radius: 50, falloff: "linear", smoothing: 0.2, fromColor: "", toColor: "",
      },
      options
    );
    if (!el) return null;
    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    const from = parseAxes(o.fromFontVariationSettings);
    const to = parseAxes(o.toFontVariationSettings);
    const axes = Array.from(from.entries()).map(([axis, f]) => ({ axis, from: f, to: to.has(axis) ? to.get(axis) : f }));

    el.setAttribute("aria-label", label);
    el.textContent = "";
    const letters = [];
    label.split(" ").forEach((word, wi, words) => {
      const w = document.createElement("span");
      w.className = "vp-word";
      w.setAttribute("aria-hidden", "true");
      Array.from(word).forEach((ch) => {
        const l = document.createElement("span");
        l.className = "vp-letter";
        l.textContent = ch;
        l.style.fontVariationSettings = o.fromFontVariationSettings;
        w.appendChild(l);
        letters.push(l);
      });
      el.appendChild(w);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(" "));
    });

    const fine = !global.matchMedia || global.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine || reduced()) return { letters };

    const pointer = { x: 0, y: 0, active: false };
    const levels = letters.map(() => 0);
    const targets = letters.map(() => 0);
    const tinted = Boolean(o.fromColor || o.toColor);
    let frame = 0;
    let lastTime = 0;
    const settingsAt = (lvl) => axes.map(({ axis, from: f, to: t }) => `'${axis}' ${(f + (t - f) * lvl).toFixed(1)}`).join(", ");

    const measure = () => {
      targets.fill(0);
      if (!pointer.active) return;
      const area = el.getBoundingClientRect();
      const dx = Math.max(area.left - pointer.x, 0, pointer.x - area.right);
      const dy = Math.max(area.top - pointer.y, 0, pointer.y - area.bottom);
      if (dx * dx + dy * dy >= o.radius * o.radius) return;
      letters.forEach((letter, i) => {
        const r = letter.getBoundingClientRect();
        targets[i] = strengthAt(Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2)), o.radius, o.falloff);
      });
    };
    const tick = (now) => {
      frame = 0;
      const delta = lastTime ? Math.min(now - lastTime, 64) : 16;
      lastTime = now;
      measure();
      const ease = o.smoothing > 0 ? 1 - Math.exp(-delta / (o.smoothing * 400)) : 1;
      let settling = false;
      letters.forEach((letter, i) => {
        let next = levels[i] + (targets[i] - levels[i]) * ease;
        if (Math.abs(targets[i] - next) < 0.002) next = targets[i];
        else settling = true;
        levels[i] = next;
        letter.style.fontVariationSettings = next === 0 ? o.fromFontVariationSettings : settingsAt(next);
        if (tinted) {
          letter.style.color = next === 0 ? (o.fromColor || "") :
            `color-mix(in oklab, ${o.fromColor || "currentColor"} ${((1 - next) * 100).toFixed(1)}%, ${o.toColor || "currentColor"})`;
        }
      });
      if (settling) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };
    global.addEventListener("mousemove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; schedule(); }, { passive: true });
    global.addEventListener("scroll", schedule, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { pointer.active = false; schedule(); });
    return { letters };
  }

  /* ======================================================================
   * TargetCursor (Animations/TargetCursor) — corner brackets that follow the pointer, spin
   * when idle and lock onto links and buttons. The native cursor stays visible.
   * ==================================================================== */
  function targetCursor(options) {
    const o = Object.assign(
      { targetSelector: "a, button", size: 36, cornerSize: 10, thickness: 2, padding: 6, spinDuration: 2.4, color: "#ffffff" },
      options
    );
    if (reduced()) return null;
    if (global.matchMedia && !global.matchMedia("(hover: hover) and (pointer: fine)").matches) return null;

    const root = document.createElement("div");
    root.className = "target-cursor";
    root.setAttribute("aria-hidden", "true");
    root.style.setProperty("--target-cursor-color", o.color);
    const corners = [0, 90, 180, 270].map(() => {
      const c = document.createElement("span");
      c.className = "target-cursor__corner";
      c.style.width = c.style.height = `${o.cornerSize}px`;
      c.style.borderWidth = `${o.thickness}px 0 0 ${o.thickness}px`;
      root.appendChild(c);
      return c;
    });
    document.body.appendChild(root);

    const spring = (s, goal, k, d, dt) => {
      for (let i = 0; i < 2; i++) { s.v += (k * (goal - s.x) - d * s.v) * (dt / 2); s.x += s.v * (dt / 2); }
    };
    const cx = { x: 0, v: 0 }, cy = { x: 0, v: 0 }, hw = { x: o.size / 2, v: 0 }, hh = { x: o.size / 2, v: 0 };
    const turn = { x: 0, v: 0 }, presence = { x: 0, v: 0 };
    const pointer = { x: 0, y: 0, inside: false, seen: false };
    let target = null;
    let spin = 0;
    let raf = 0;
    let last = 0;

    const tick = (now) => {
      raf = 0;
      const dt = clamp((now - last) / 1000 || 0.016, 0.001, 0.05);
      last = now;
      let gx = pointer.x, gy = pointer.y, gw = o.size / 2, gh = o.size / 2, gTurn;
      if (target && !document.contains(target)) target = null;
      if (target) {
        const r = target.getBoundingClientRect();
        gx = r.left + r.width / 2;
        gy = r.top + r.height / 2;
        gw = r.width / 2 + o.padding;
        gh = r.height / 2 + o.padding;
        gTurn = Math.round(turn.x / 90) * 90;
      } else {
        spin += (360 / o.spinDuration) * dt;
        gTurn = spin;
      }
      if (!pointer.seen) { cx.x = gx; cy.x = gy; pointer.seen = true; }
      const k = target ? 260 : 900, d = target ? 30 : 60;
      spring(cx, gx, k, d, dt);
      spring(cy, gy, k, d, dt);
      spring(hw, gw, 300, 32, dt);
      spring(hh, gh, 300, 32, dt);
      if (target) { spring(turn, gTurn, 260, 30, dt); spin = turn.x; }
      else { turn.x = spin; turn.v = 0; }
      spring(presence, pointer.inside ? 1 : 0, 200, 28, dt);

      // Each bracket moves to the next corner slot every quarter turn, so a box locked onto a
      // target always lines up with the target's width and height.
      const quarter = Math.round(turn.x / 90);
      const residual = turn.x - quarter * 90;
      const rad = (residual * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const slots = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      corners.forEach((corner, i) => {
        const slot = (((i + quarter) % 4) + 4) % 4;
        const px = slots[slot][0] * hw.x, py = slots[slot][1] * hh.x;
        const x = cx.x + px * cos - py * sin;
        const y = cy.x + px * sin + py * cos;
        corner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(slot * 90 + residual).toFixed(2)}deg)`;
      });
      root.style.opacity = clamp01(presence.x).toFixed(3);
      const moving = Math.abs(gx - cx.x) + Math.abs(gy - cy.x) + Math.abs(gw - hw.x) + Math.abs(gh - hh.x) > 0.3 || Math.abs(presence.v) > 0.01;
      if (pointer.inside || moving || presence.x > 0.01) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

    global.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.inside = true;
      const hit = e.target instanceof Element ? e.target.closest(o.targetSelector) : null;
      target = hit && !hit.closest("[hidden]") ? hit : null;
      wake();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { pointer.inside = false; target = null; wake(); });
    global.addEventListener("blur", () => { pointer.inside = false; wake(); });
    global.addEventListener("scroll", () => { if (target) wake(); }, { passive: true });
    return { root };
  }

  global.ReactBits = {
    dotGrid, splitText, scrollReveal, countUp, spotlightCard, magnet, tiltedCard, variableProximity, targetCursor,
  };
})(window);
