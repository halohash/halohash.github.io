(() => {
  document.querySelectorAll('.home-welcome').forEach(el => {
    el.style.display = 'none';
  });

  const FLOOR_HEIGHT = 48;
  const GRAVITY = 0.6;
  const BOUNCE = 0.4;
  const bodies = [];

  const shortcuts = Array.from(document.querySelectorAll('.shortcut'));
  const initialRects = shortcuts.map(el => el.getBoundingClientRect());

  shortcuts.forEach((el, i) => {
    const rect = initialRects[i];
    el.style.position = 'fixed';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.margin = '0';
    el.style.zIndex = '9999';
    el.style.transform = `translate(${rect.left}px, ${rect.top}px)`;

    bodies.push({
      el,
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      vy: 0,
      isCube: false
    });
  });

  function spawnCube() {
    const size = 16;
    const cube = document.createElement('div');
    cube.style.position = 'fixed';
    cube.style.left = '0px';
    cube.style.top = '0px';
    cube.style.width = `${size}px`;
    cube.style.height = `${size}px`;
    cube.style.backgroundColor = '#22c55e';
    cube.style.pointerEvents = 'none';
    cube.style.zIndex = '9998';
    document.body.appendChild(cube);

    const startX = Math.random() * (window.innerWidth - size);
    bodies.push({
      el: cube,
      x: startX,
      y: -size,
      w: size,
      h: size,
      vy: 0,
      isCube: true
    });
  }

  setInterval(spawnCube, 2500);

  function update() {
    const floorY = window.innerHeight - FLOOR_HEIGHT;

    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      b.vy += GRAVITY;
      b.y += b.vy;

      if (b.y + b.h >= floorY) {
        b.y = floorY - b.h;
        b.vy *= -BOUNCE;

        if (Math.abs(b.vy) < 1) {
          b.vy = 0;
        }
      }

      b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    }

    const cubes = bodies.filter(b => b.isCube);
    if (cubes.length > 299) {
      const oldest = cubes[0];
      oldest.el.remove();
      bodies.splice(bodies.indexOf(oldest), 1);
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
})();
