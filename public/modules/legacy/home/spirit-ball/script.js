const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Site-integration note: the original animation used a fixed 600x600
// canvas. Embedded here in the homepage hero via an iframe, it instead
// fills whatever box the iframe is given and re-centers on resize.
let centerX, centerY;

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Animation States: 0 = Orbiting, 1 = Merging, 2 = Exploding, 3 = Imploding
let animationState = 0;
let stateTimer = 0;

// Core Spirit Ball Properties
const coreBall = {
    x: centerX,
    y: centerY,
    baseRadius: 35,
    radius: 35,
    pulseSpeed: 0.05,
    pulseTime: 0,
    alpha: 1
};

// Teardrop Orbiter Class
class TeardropSpirit {
    constructor(id) {
        this.id = id;
        this.reset();
    }

    reset() {
        this.angleX = Math.random() * Math.PI * 2;
        this.angleY = Math.random() * Math.PI * 2;
        this.speedX = 0.02 + Math.random() * 0.02;
        this.speedY = 0.03 + Math.random() * 0.03;
        this.radiusX = 80 + Math.random() * 40;
        this.radiusY = 80 + Math.random() * 40;
        this.size = 12;
        this.trail = [];
        this.maxTrail = 15;
        this.x = centerX;
        this.y = centerY;
        this.mergeProgress = 0;
    }

    update() {
        // Save past positions for the trail effect
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }

        if (animationState === 0) {
            // Geometric complex orbit logic
            this.angleX += this.speedX;
            this.angleY += this.speedY;

            // Lissajous/Geometric wave calculation
            this.targetX = centerX + Math.cos(this.angleX) * this.radiusX;
            this.targetY = centerY + Math.sin(this.angleY) * this.radiusY;

            // Smooth transition out from center initially
            this.x += (this.targetX - this.x) * 0.1;
            this.y += (this.targetY - this.y) * 0.1;

        } else if (animationState === 1) {
            // Pull smoothly back into core center
            this.x += (centerX - this.x) * 0.15;
            this.y += (centerY - this.y) * 0.15;
        }
    }

    draw() {
        // Draw the fading trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.4;
            ctx.fillStyle = `rgba(0, 220, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.size * (i / this.trail.length), 0, Math.PI * 2);
            ctx.fill();
        }

        // Calculate angle of movement to orient the teardrop tip backward
        let dx = 0;
        let dy = -1;
        if (this.trail.length > 0) {
            const lastPos = this.trail[this.trail.length - 1];
            dx = this.x - lastPos.x;
            dy = this.y - lastPos.y;
        }
        let angle = Math.atan2(dy, dx);

        // Draw the main Teardrop head shape
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle - Math.PI / 2); // Align point away from movement direction

        ctx.fillStyle = 'rgba(150, 240, 255, 0.9)';
        ctx.beginPath();
        // Create tear contour using bezier curves
        ctx.moveTo(0, this.size * 1.5); // Tip point
        ctx.bezierCurveTo(this.size, this.size, this.size, -this.size / 2, 0, -this.size / 2);
        ctx.bezierCurveTo(-this.size, -this.size / 2, -this.size, this.size, 0, this.size * 1.5);
        ctx.closePath();
        ctx.fill();

        // Inner glow highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Pixel/Explosion Particle Class
class PixelParticle {
    constructor(x, y) {
        this.originX = x;
        this.originY = y;
        this.x = x;
        this.y = y;
        
        // Explode angle and speeds
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 6;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.size = 2 + Math.random() * 3;
        this.color = Math.random() > 0.5 ? '#00e1ff' : '#ffffff';
        this.friction = 0.96;
    }

    updateExplosion() {
        // Apply friction so pixels slow down during explosion spread
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
    }

    updateImplosion(progress) {
        // Linear interpolation to snap perfectly back to original pixel layout
        this.x = this.x + (this.originX - this.x) * progress;
        this.y = this.y + (this.originY - this.y) * progress;
    }

    draw() {
        ctx.fillStyle = this.color;
        // Square/Pixel look
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
}

// Initialize 3 orbiters
const orbiters = [new TeardropSpirit(0), new TeardropSpirit(1), new TeardropSpirit(2)];
let pixelParticles = [];

// Generate Pixel Grid layout matching the core shape for clean structural rebuilding
function generateCorePixels() {
    pixelParticles = [];
    const radius = coreBall.baseRadius;
    // Scan an area to cut out a round structural grid of pixel items
    for (let x = -radius; x <= radius; x += 3) {
        for (let y = -radius; y <= radius; y += 3) {
            if (x * x + y * y <= radius * radius) {
                pixelParticles.push(new PixelParticle(centerX + x, centerY + y));
            }
        }
    }
}

// Core Main Loop
function animate() {
    // Fully clear each frame (rather than painting a translucent dark
    // rect) so the page behind the iframe shows through transparently.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stateTimer++;

    // Global State Engine
    if (animationState === 0 && stateTimer > 240) { 
        // Transition Orbit -> Merge after 4 seconds
        animationState = 1;
        stateTimer = 0;
    } else if (animationState === 1 && stateTimer > 40) { 
        // Transition Merge -> Explode
        animationState = 2;
        stateTimer = 0;
        generateCorePixels(); // Create pixel structural copy
    } else if (animationState === 2 && stateTimer > 60) { 
        // Transition Explode -> Implode after 1 second
        animationState = 3;
        stateTimer = 0;
    } else if (animationState === 3 && stateTimer > 50) { 
        // Transition Implode -> Orbit restart
        animationState = 0;
        stateTimer = 0;
        orbiters.forEach(o => o.reset());
    }

    // --- STAGE RENDERERS ---

    if (animationState === 0 || animationState === 1) {
        // Pulse core size effect
        coreBall.pulseTime += coreBall.pulseSpeed;
        coreBall.radius = coreBall.baseRadius + Math.sin(coreBall.pulseTime) * 3;

        // Render Central Spirit Core Glow
        let glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreBall.radius * 1.8);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.3, 'rgba(0, 180, 255, 0.8)');
        glow.addColorStop(0.6, 'rgba(0, 70, 255, 0.3)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreBall.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Solid inner sphere
        ctx.fillStyle = '#e6f9ff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, coreBall.radius, 0, Math.PI * 2);
        ctx.fill();

        // Manage and Draw Teardrop Orbiters
        orbiters.forEach(orbiter => {
            orbiter.update();
            orbiter.draw();
        });
    } 
    else if (animationState === 2) {
        // Exploding Pixels Processing
        pixelParticles.forEach(p => {
            p.updateExplosion();
            p.draw();
        });
    } 
    else if (animationState === 3) {
        // Imploding Pixels Processing
        let progress = Math.min(stateTimer / 45, 1);
        pixelParticles.forEach(p => {
            p.updateImplosion(progress);
            p.draw();
        });
    }

    requestAnimationFrame(animate);
}

// Launch Application Loop
animate();
