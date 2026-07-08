import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x080907, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080907, 0.045);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.8, 8.2);

const rig = new THREE.Group();
scene.add(rig);

const ambient = new THREE.AmbientLight(0xf7f3ea, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x59dccb, 2.4);
keyLight.position.set(4, 6, 6);
scene.add(keyLight);

const warmLight = new THREE.PointLight(0xe0a756, 22, 18);
warmLight.position.set(-4, 1.2, 3.4);
scene.add(warmLight);

const violetLight = new THREE.PointLight(0xb199ff, 12, 14);
violetLight.position.set(3.8, -1.8, 2.5);
scene.add(violetLight);

const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8fff8,
    metalness: 0.22,
    roughness: 0.18,
    transmission: 0.35,
    thickness: 1.2,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
});

const core = new THREE.Mesh(new THREE.TorusKnotGeometry(1.18, 0.27, 220, 28), coreMaterial);
core.position.set(2.3, 0.28, -0.9);
core.rotation.set(0.45, 0.2, -0.16);
rig.add(core);

const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.18, 2)),
    new THREE.LineBasicMaterial({ color: 0x59dccb, transparent: true, opacity: 0.34 })
);
wire.position.copy(core.position);
rig.add(wire);

const ringGroup = new THREE.Group();
const ringMaterialA = new THREE.MeshStandardMaterial({
    color: 0xe0a756,
    metalness: 0.65,
    roughness: 0.28,
    transparent: true,
    opacity: 0.78,
});
const ringMaterialB = new THREE.MeshStandardMaterial({
    color: 0x8fd46f,
    metalness: 0.48,
    roughness: 0.34,
    transparent: true,
    opacity: 0.58,
});

for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.65 + i * 0.34, 0.012, 12, 180), i % 2 ? ringMaterialA : ringMaterialB);
    ring.rotation.set(Math.PI / 2.35, i * 0.82, Math.PI / 7);
    ringGroup.add(ring);
}
ringGroup.position.copy(core.position);
rig.add(ringGroup);

const lattice = new THREE.Group();
const tileMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7f3ea,
    metalness: 0.35,
    roughness: 0.5,
    transparent: true,
    opacity: 0.2,
});
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf7f3ea, transparent: true, opacity: 0.22 });
const boxGeometry = new THREE.BoxGeometry(0.46, 0.46, 0.04);

for (let x = -5; x <= 5; x += 1) {
    for (let y = -2; y <= 2; y += 1) {
        const tile = new THREE.Mesh(boxGeometry, tileMaterial);
        tile.position.set(x * 0.8 - 2.6, y * 0.64 - 0.15, -3.2 - Math.abs(x) * 0.05);
        tile.rotation.set(0.08 * y, -0.18, 0.05 * x);
        lattice.add(tile);

        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), edgeMaterial);
        edge.position.copy(tile.position);
        edge.rotation.copy(tile.rotation);
        lattice.add(edge);
    }
}
lattice.position.set(-1.4, -0.15, -0.7);
rig.add(lattice);

const shardsGeometry = new THREE.TetrahedronGeometry(0.055, 0);
const shardsMaterial = new THREE.MeshStandardMaterial({
    color: 0x59dccb,
    metalness: 0.55,
    roughness: 0.32,
});
const shards = new THREE.InstancedMesh(shardsGeometry, shardsMaterial, 160);
const dummy = new THREE.Object3D();
const shardData = [];

for (let i = 0; i < 160; i += 1) {
    const radius = 3.1 + Math.random() * 5.4;
    const angle = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 5.5;
    shardData.push({
        radius,
        angle,
        y,
        speed: 0.08 + Math.random() * 0.18,
        scale: 0.6 + Math.random() * 2.3,
    });
    dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius - 2.2);
    dummy.scale.setScalar(shardData[i].scale);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.updateMatrix();
    shards.setMatrixAt(i, dummy.matrix);
}
rig.add(shards);

const linePositions = [];
for (let i = 0; i < 90; i += 1) {
    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 5.4;
    const z = -2.6 - Math.random() * 5;
    linePositions.push(x, y, z, x + (Math.random() - 0.5) * 1.6, y + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 1.4);
}

const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
const dataLines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0xe0a756, transparent: true, opacity: 0.14 })
);
rig.add(dataLines);

const pointer = { x: 0, y: 0 };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("resize", () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

function animate(time) {
    const t = time * 0.001;
    const speed = reducedMotion ? 0.15 : 1;
    const scroll = window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1);

    core.rotation.x += 0.0035 * speed;
    core.rotation.y += 0.005 * speed;
    wire.rotation.x -= 0.0018 * speed;
    wire.rotation.y += 0.0032 * speed;
    ringGroup.rotation.y = t * 0.18 * speed;
    ringGroup.rotation.x = Math.sin(t * 0.35) * 0.14;
    lattice.rotation.y = Math.sin(t * 0.18) * 0.08 + pointer.x * 0.04;
    dataLines.rotation.y = -t * 0.035 * speed;

    for (let i = 0; i < shardData.length; i += 1) {
        const item = shardData[i];
        const angle = item.angle + t * item.speed * speed;
        dummy.position.set(
            Math.cos(angle) * item.radius,
            item.y + Math.sin(t * item.speed + i) * 0.12,
            Math.sin(angle) * item.radius - 2.2
        );
        dummy.rotation.set(t * 0.3 + i, t * 0.22 + i * 0.2, t * 0.11);
        dummy.scale.setScalar(item.scale);
        dummy.updateMatrix();
        shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;

    rig.rotation.y += ((pointer.x * 0.16) - rig.rotation.y) * 0.035;
    rig.rotation.x += ((-pointer.y * 0.08) - rig.rotation.x) * 0.035;
    camera.position.z = 8.2 - scroll * 1.3;
    camera.position.y = 0.8 - scroll * 0.7;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

const tiltCards = document.querySelectorAll("[data-tilt]");

tiltCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
        if (window.innerWidth < 800 || reducedMotion) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${y * -5}deg) rotateY(${x * 7}deg) translateY(-3px)`;
    });

    card.addEventListener("pointerleave", () => {
        card.style.transform = "";
    });
});

const filterButtons = document.querySelectorAll(".filter-btn");
const searchInput = document.querySelector("#promptSearch");
const promptCards = document.querySelectorAll(".prompt-card");
let activeFilter = "all";

function applyPromptFilters() {
    const query = searchInput.value.trim().toLowerCase();
    promptCards.forEach((card) => {
        const matchesFilter = activeFilter === "all" || card.dataset.topic === activeFilter;
        const matchesSearch = card.innerText.toLowerCase().includes(query);
        card.classList.toggle("is-hidden", !(matchesFilter && matchesSearch));
    });
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.dataset.filter;
        applyPromptFilters();
    });
});

searchInput.addEventListener("input", applyPromptFilters);

document.querySelectorAll(".copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
        const text = button.closest(".prompt-card").querySelector("code").innerText;
        try {
            await navigator.clipboard.writeText(text);
            button.textContent = "Copied";
            setTimeout(() => {
                button.textContent = "Copy prompt";
            }, 1300);
        } catch {
            button.textContent = "Select and copy";
        }
    });
});

const navLinks = document.querySelectorAll(".nav-links a");
const sections = [...navLinks].map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
        });
    });
}, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });

sections.forEach((section) => observer.observe(section));
