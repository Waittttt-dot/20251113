/*
Quiz 程式（修正版）
依原始檔案的描述：
- preload() 載入 questions.csv（有 header: question, optionA..D, answer）
- 題目最多使用前 5 題
- 選項會隨機排列，但保留 letter 用於判分
*/

let table;
let questions = [];
let current = 0;
let score = 0;
let state = 'quiz';
let optionRects = [];
let clickEffect = [];
let layoutMode = 'single';
let confetti = [];
let stars = [];
let shootingStars = [];
let resultMode = '';

const bgTop = '#bde0fe';
const bgBottom = '#a2d2ff';
const shootingStarHex = '#ffb703';
const ribbonColors = ['#ffafcc', '#ffc8dd', '#cdb4db'];

function preload() {
	table = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
	createCanvas(windowWidth, windowHeight);
	textFont('Segoe UI');
	parseTable();
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

function parseTable() {
	questions = [];
	if (!table) return;
	for (let r = 0; r < table.getRowCount(); r++) {
		let row = table.getRow(r);
		let rawAnswer = (row.get('answer') || '').trim();
		// 若答案為單一英文字母，轉成大寫 A/B/C/D，否則保留原文字（例如中文或 H2O）
		let normalizedAnswer = rawAnswer;
		if (normalizedAnswer.length === 1 && /[a-zA-Z]/.test(normalizedAnswer)) normalizedAnswer = normalizedAnswer.toUpperCase();
		questions.push({
			question: row.get('question') || '',
			options: [row.get('optionA') || '', row.get('optionB') || '', row.get('optionC') || '', row.get('optionD') || ''],
			answer: normalizedAnswer,
			shuffledOptions: [],
			revealed: false,
			pressedIndex: -1,
			selectedIndex: -1,
			_revealTimer: null
		});
	}
	// 打散題目順序以實現隨機出題，再取前 5 題
	shuffleArray(questions);
	if (questions.length > 5) questions = questions.slice(0, 5);
	if (questions.length > 0) prepareQuestion(0);
}

function draw() {
	drawBackgroundGradient();
	updateShootingStars();
	drawShootingStars();
	// 如果題庫尚未載入或沒有題目，顯示提示並等待使用者重新載入
	if (!questions || questions.length === 0) {
		textAlign(CENTER, CENTER);
		fill(0);
		textSize(20);
		text('題庫載入中或無題目。請確認 `questions.csv` 是否存在，或點擊畫面重新載入。', width/2, height/2);
		drawCursor();
		runClickEffects();
		return;
	}

	if (state === 'quiz') drawQuiz();
	else if (state === 'result') drawResult();
	drawCursor();
	runClickEffects();
}

function drawBackgroundGradient() {
	for (let y = 0; y <= height; y++) {
		let t = y / height;
		let c = lerpColor(color(bgTop), color(bgBottom), t);
		stroke(c);
		line(0, y, width, y);
	}
}

function drawQuiz() {
	if (current >= questions.length) { state = 'result'; return; }
	let q = questions[current];
	layoutMode = (width > 900) ? 'two' : 'single';
	let base = constrain(min(width, height) / 30, 14, 36);

	let margin = 60;
	let qy = margin;
	fill(255); noStroke(); textSize(base + 8); textAlign(LEFT, TOP);
	text(q.question, margin, qy, width - margin * 2);

	optionRects = [];
	textSize(18);
	let oy = qy + 100;
	let h = constrain(base * 2.6, 48, 90);
	if (!q.shuffledOptions || q.shuffledOptions.length === 0) prepareQuestion(current);

	let cols = (layoutMode === 'two') ? 2 : 1;
	let ow = (width - margin * 2 - (cols - 1) * 30) / cols;
	for (let i = 0; i < q.shuffledOptions.length; i++) {
		let col = i % cols;
		let rowIdx = floor(i / cols);
		let ox = margin + col * (ow + 30);
		let oy_i = oy + rowIdx * (h + 20);
		randomSeed((current + 1) * 1000 + i * 37);
		ox += random(-12, 12);
		oy_i += random(-6, 6);
		let hovered = mouseX > ox && mouseX < ox + ow && mouseY > oy_i && mouseY < oy_i + h;
		stroke(200); strokeWeight(1);
		let reveal = q.revealed === true;
		let opt = q.shuffledOptions[i];
		// 支援以選項字母或選項文字與 q.answer 比對
		let isCorrect = false;
		let qa = q.answer || '';
		if (opt) {
			if (opt.letter === qa) isCorrect = true;
			else if (opt.text && opt.text.trim() === qa) isCorrect = true;
		}
		if (reveal) {
			if (isCorrect) { fill(40,200,120); stroke(200); }
			else if (q.selectedIndex === i) { fill(220,80,80); stroke(200); }
			else { fill(200); stroke(150); }
		} else {
			if (q.pressedIndex === i) { fill('#caf0f8'); stroke(100); }
			else if (hovered) { fill(70,130,180); stroke(255); } else { fill(255,250); }
		}
		rect(ox, oy_i, ow, h, 10);
		noStroke(); fill(reveal ? 255 : (hovered ? 255 : 20)); textAlign(LEFT, CENTER);
		text(opt.displayLabel + '. ' + opt.text, ox + 20, oy_i + h / 2);
		optionRects.push({x: ox, y: oy_i, w: ow, h: h, index: i});
	}

	let btnW = 160, btnH = 48;
	let bx = (layoutMode === 'single') ? (width - btnW) / 2 : (width - margin - btnW);
	let by = height - margin - btnH;
	stroke(180); fill(q.revealed ? color(40,200,120) : color(100)); rect(bx, by, btnW, btnH, 8);
	noStroke(); fill(255); textAlign(CENTER, CENTER); textSize(18);
	text(q.revealed ? '下一題' : '選擇一個選項', bx + btnW / 2, by + btnH / 2);
}

function mousePressed() {
	// 如果尚未載入題庫，嘗試重新載入
	if (!questions || questions.length === 0) {
		table = loadTable('questions.csv', 'csv', 'header', function(tbl) { table = tbl; parseTable(); });
		createClickEffect(mouseX, mouseY);
		return;
	}

	if (state === 'quiz') {
		let q = questions[current];
		for (let r of optionRects) {
			if (mouseX > r.x && mouseX < r.x + r.w && mouseY > r.y && mouseY < r.y + r.h) {
				createClickEffect(mouseX, mouseY);
				q.pressedIndex = r.index;
				if (q._revealTimer) clearTimeout(q._revealTimer);
				q._revealTimer = setTimeout(() => {
					q.revealed = true;
					q.selectedIndex = r.index;
					let chosen = q.shuffledOptions[r.index];
					if (chosen) {
						// 若選項的 letter 或文字與答案相符，視為正確
						if (chosen.letter === q.answer || (chosen.text && chosen.text.trim() === q.answer)) score++;
					}
					q.pressedIndex = -1;
				}, 250);
			}
		}
		// 下一題按鈕區域
		let margin = 60; let btnW = 160, btnH = 48;
		let bx = (layoutMode === 'single') ? (width - btnW) / 2 : (width - margin - btnW);
		let by = height - margin - btnH;
		if (mouseX > bx && mouseX < bx + btnW && mouseY > by && mouseY < by + btnH) {
			if (questions[current] && questions[current].revealed) {
				current++;
				if (current < questions.length) {
					prepareQuestion(current);
				} else {
					if (score <= 1) resultMode = 'poor';
					else if (score <= 3) resultMode = 'ok';
					else if (score === 4) resultMode = 'great';
					else resultMode = 'perfect';
					state = 'result';
				}
				createClickEffect(mouseX, mouseY);
			}
		}
	} else if (state === 'result') {
		resetQuiz(); createClickEffect(mouseX, mouseY);
	}
}

function resetQuiz() {
	current = 0; score = 0; state = 'quiz'; optionRects = []; confetti = []; stars = []; shootingStars = [];
	if (questions.length > 0) prepareQuestion(0);
}

function shuffleArray(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		let j = floor(random(i + 1));
		let tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
	}
}

function prepareQuestion(idx) {
	let q = questions[idx];
	let opts = [];
	for (let i = 0; i < q.options.length; i++) opts.push({text: q.options[i], letter: String.fromCharCode(65 + i)});
	randomSeed((idx + 1) * 7919);
	shuffleArray(opts);
	for (let i = 0; i < opts.length; i++) opts[i].displayLabel = String.fromCharCode(65 + i);
	q.shuffledOptions = opts; q.revealed = false; q.selectedIndex = -1; q.pressedIndex = -1;
}

function updateShootingStars() {
	let baseProb = 0.02; let maxStars = 8;
	if (resultMode === 'perfect') { baseProb = 0.08; maxStars = 40; }
	else if (resultMode === 'great') { baseProb = 0.05; maxStars = 20; }
	else if (resultMode === 'ok') { baseProb = 0.03; maxStars = 12; }
	else if (resultMode === 'poor') { baseProb = 0.01; maxStars = 6; }
	if (random() < baseProb && shootingStars.length < maxStars) {
		shootingStars.push({x: random(width * 0.2, width), y: random(0, height * 0.3), vx: random(-10, -4), vy: random(2, 6), life: 0, maxLife: random(30, 90)});
	}
	for (let i = shootingStars.length - 1; i >= 0; i--) {
		let s = shootingStars[i]; s.x += s.vx; s.y += s.vy; s.life++; if (s.life > s.maxLife) shootingStars.splice(i, 1);
	}
}

function drawShootingStars() {
	noStroke();
	let sc = color(shootingStarHex);
	for (let s of shootingStars) {
		let t = s.life / s.maxLife;
		let alpha = 255 * (1 - t);
		push(); translate(s.x, s.y); rotate(atan2(s.vy, s.vx)); fill(red(sc), green(sc), blue(sc), alpha); rect(0, 0, 2 + (1 - t) * 6, 2 + (1 - t) * 2); pop();
		stroke(red(sc), green(sc), blue(sc), alpha * 0.6); strokeWeight(1); line(s.x - s.vx * 2, s.y - s.vy * 2, s.x, s.y);
	}
	noStroke();
}

function drawResult() {
	textAlign(CENTER, CENTER);
	fill(0); textSize(24); text('測驗結束', width/2, 120);
	text(`得分: ${score} / ${questions.length}`, width/2, 160);
	let msg = '';
	if (score <= 1) { msg = '別灰心，下一次會更好！我們一起加油吧。'; resultMode = 'poor'; drawWaves(); }
	else if (score <= 3) { msg = '做得不錯，繼續保持努力！'; resultMode = 'ok'; drawStars(); }
	else if (score === 4) { msg = '好厲害！接近完美，再接再厲！'; resultMode = 'great'; drawConfetti(); }
	else { msg = '太棒了！你全對了！🎉🎉'; resultMode = 'perfect'; drawConfetti(); }
	textSize(20); fill(0); text(msg, width/2, 200);
	textSize(16); fill(0); text('點擊任意處重新開始', width/2, height - 80);
}

function drawConfetti() {
	let maxConf = 180;
	if (resultMode === 'poor') maxConf = 80; else if (resultMode === 'ok') maxConf = 140; else if (resultMode === 'great') maxConf = 260; else if (resultMode === 'perfect') maxConf = 420;
	if (confetti.length < maxConf) {
		let spawn = (resultMode === 'perfect') ? 12 : (resultMode === 'great' ? 8 : (resultMode === 'ok' ? 5 : 3));
		for (let i = 0; i < spawn; i++) confetti.push({x: random(width), y: -10, vy: random(1,4), c: color(random(ribbonColors)), r: random(4,14), angle: random(TAU)});
	}
	for (let p of confetti) { fill(p.c); noStroke(); push(); translate(p.x,p.y); rotate(p.angle); rect(0,0,p.r,p.r*0.6); pop(); let speedMul = (resultMode === 'perfect') ? 2 : (resultMode === 'great' ? 1.4 : (resultMode === 'ok' ? 1 : 0.8)); p.y += p.vy * speedMul; p.angle += 0.05 * speedMul; }
}

function drawStars() {
	let desired = 80; if (resultMode === 'poor') desired = 40; else if (resultMode === 'ok') desired = 100; else if (resultMode === 'great') desired = 160; else if (resultMode === 'perfect') desired = 240;
	if (stars.length < desired) { let add = min(6, desired - stars.length); for (let i = 0; i < add; i++) stars.push({x: random(width), y: random(height/2, height), size: random(2,6), vy: random(-0.5,-1.5)}); }
	for (let s of stars) { fill(255,240,120,200); noStroke(); ellipse(s.x,s.y,s.size); let speedMul = (resultMode === 'perfect') ? 1.4 : (resultMode === 'great' ? 1.2 : (resultMode === 'ok' ? 1 : 0.8)); s.y += s.vy * speedMul; if (s.y < -10) s.y = height + 10; }
}

function drawWaves() {
	noStroke(); let baseAmp = 40; if (resultMode === 'poor') baseAmp = 60; else if (resultMode === 'ok') baseAmp = 40; else if (resultMode === 'great') baseAmp = 28; else if (resultMode === 'perfect') baseAmp = 18;
	for (let i = 0; i < 4; i++) { fill(50,80,160,120 - i * 20); beginShape(); for (let x = 0; x <= width; x += 20) { let y = height/2 + 120 + sin((x * 0.01) + frameCount * 0.02 + i) * (baseAmp - i * 6); vertex(x, y); } vertex(width, height); vertex(0, height); endShape(CLOSE); }
}

function drawCursor() { push(); noStroke(); fill(255,150); ellipse(mouseX, mouseY, 14); fill(255); ellipse(mouseX, mouseY, 6); pop(); }

function createClickEffect(x,y) { clickEffect.push({x,y,r:0,alpha:180}); }

function runClickEffects() { for (let i = clickEffect.length - 1; i >= 0; i--) { let e = clickEffect[i]; stroke(255, e.alpha); noFill(); strokeWeight(2); ellipse(e.x, e.y, e.r); e.r += 8; e.alpha -= 12; if (e.alpha <= 0) clickEffect.splice(i,1); } }
