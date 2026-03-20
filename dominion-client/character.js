document.addEventListener('DOMContentLoaded', async () => {

  const token = localStorage.getItem('access_token');
  const status = document.getElementById('status');
  const createBtn = document.getElementById('createBtn');

  // --- AUTH CHECK ---
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // --- CHECK PROFILE ---
  let meRes;
  try {
    meRes = await fetch('/profile/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    status.textContent = "Network error. Try again.";
    return;
  }

  if (!meRes.ok) {
    localStorage.removeItem('access_token');
    status.textContent = "Session expired. Please log in again.";
    return;
  }

  const meData = await meRes.json();

  if (!meData.needsSetup) {
    localStorage.setItem('profile', JSON.stringify(meData));
    window.location.href = 'game.html';
    return;
  }

  status.textContent = "Welcome, hero. Shape your form.";

  // --- THREE.JS SETUP ---
  const canvas = document.getElementById('scene');
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 3;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const geometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const character = new THREE.Mesh(geometry, material);
  scene.add(character);

  scene.add(new THREE.AmbientLight(0x404040));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.01;
    character.rotation.y += 0.002;
    character.position.y = Math.sin(t) * 0.03;
    renderer.render(scene, camera);
  }
  animate();

  // --- HANDLE RESIZE ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- RACE PREVIEW ---
  const raceColors = {
    human: 0xaaaaaa,
    elf: 0x55ff99,
    dwarf: 0xffaa55,
    voidborn: 0x8844ff
  };

  document.getElementById('race').addEventListener('change', e => {
    material.color.setHex(raceColors[e.target.value] || 0xaaaaaa);
  });

  // --- CREATE CHARACTER ---
  createBtn.addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const race = document.getElementById('race').value;

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      status.textContent = "Username must be 3–16 characters (letters, numbers, _).";
      return;
    }

    createBtn.disabled = true;
    status.textContent = "Forging your legend…";

    const res = await fetch('/profile/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ username, race })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      status.textContent = data.error || "Creation failed.";
      createBtn.disabled = false;
      return;
    }

    localStorage.setItem('profile', JSON.stringify(data));
    window.location.href = 'game.html';
  });

  // --- R3F CONFIGURATOR ---
  const iframe = document.getElementById('r3fFrame');
  const link = document.getElementById('open-r3f');

  const devUrl = 'http://localhost:5173/create-character.html';
  const localUrl = '../r3f-ultimate-character-configurator-main/create-character.html';

  iframe.src = localUrl;
  link.href = localUrl;

  fetch('http://localhost:5173/', { mode: 'no-cors' })
    .then(() => {
      iframe.src = devUrl;
      link.href = devUrl;
      link.textContent = 'Open Advanced Creator (Dev)';
    })
    .catch(() => {});

  window.addEventListener('message', e => {
    if (e.data?.type === 'characterSaved') {
      localStorage.setItem('profile', JSON.stringify(e.data.profile));
      window.location.href = 'game.html';
    }
  });

});
