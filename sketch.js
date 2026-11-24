let bgImage, characterSprite, walkSprite, magicSprite, magicEffectSprite;
let char2StopSprite, char2ActionSprite, char2CorrectSprite;

let bgOffsetX = 0;
let characterX;
let isWalking = false;
let facingDirection = 1;
let isCasting = false;
let magicStartFrame = 0;
let magicDirection = 1;
let spaceIsDown = false;
let activeEffects = [];
let fireworks = []; // 儲存答對時放出的煙花粒子

let wasChar1Near = false;
let currentQuestion = null;
let selectedOptionIndex = null;
let isCurrentQuestionCorrect = false;
let correctAnimStartFrame = 0; // 記錄答對當下的 frameCount，用來從第 0 格開始播動作
let optionBoxes = [];

const frameCountInSprite = 10, frameWidth = 139.5, frameHeight = 196;
const walkFrameCount = 9, walkFrameWidth = 1246 / 9, walkFrameHeight = 198;
const magicFrameCount = 4, magicFrameWidth = 1039 / 4, magicFrameHeight = 146;
const effectFrameCount = 5, effectFrameWidth = 740 / 5, effectFrameHeight = 19;

const char2StopFrameCount = 8, char2StopFrameWidth = 699 / 8, char2StopFrameHeight = 190;
const char2ActionFrameCount = 12, char2ActionFrameWidth = 1627 / 12, char2ActionFrameHeight = 171;

// 答對後才觸發的角色二動作設定
const char2CorrectFrameCount = 12, char2CorrectFrameWidth = 1627 / 12, char2CorrectFrameHeight = 171;
const framesPerStep = 8;

function safeLoadImage(path) {
  return loadImage(path, () => {}, () => console.warn("載入失敗：", path));
}

function generateMultiplicationQuestion() {
  // 簡單的乘法（1~9 的乘法表）
  const a = floor(random(1, 10));
  const b = floor(random(1, 10));
  const answer = a * b;
  const set = new Set([answer]);

  // 優先加入常見乘法干擾項，不足再補鄰近數字
  const nearbyCandidates = [
    a * max(1, b - 1),
    a * min(9, b + 1),
    max(1, a - 1) * b,
    min(9, a + 1) * b,
    answer + 2,
    answer - 2,
    answer + 5,
    max(1, answer - 3)
  ];

  for (let i = 0; i < nearbyCandidates.length && set.size < 4; i++) {
    const c = nearbyCandidates[i];
    if (c > 0 && c !== answer) set.add(c);
  }

  while (set.size < 4) {
    const c = answer + floor(random(-5, 6));
    if (c > 0 && c !== answer) set.add(c);
  }

  const options = Array.from(set).sort(() => random() - 0.5);
  return { text: a + " × " + b + " = ?", options: options, answer: answer };
}

function spawnFireworkBurst(centerX, centerY) {
  const palette = [
    [255, 80, 120],
    [255, 210, 60],
    [90, 220, 255],
    [130, 255, 140],
    [255, 140, 255],
    [255, 150, 70]
  ];
  const baseColor = random(palette);
  const particleCount = 34;

  for (let i = 0; i < particleCount; i++) {
    const angle = (TWO_PI / particleCount) * i + random(-0.08, 0.08);
    const speed = random(2.5, 7.5);
    const sparkColor = random() < 0.25 ? random(palette) : baseColor;
    fireworks.push({
      x: centerX,
      y: centerY,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - random(0.5, 2.0),
      alpha: 255,
      size: random(4, 8.5),
      color: sparkColor,
      decay: random(3.5, 6.2)
    });
  }
}

function triggerCorrectCelebration(char2X, char2Y) {
  spawnFireworkBurst(char2X, char2Y - 50);
  spawnFireworkBurst(width * 0.35, height * 0.28);
  spawnFireworkBurst(width * 0.65, height * 0.28);
}

function updateAndDrawFireworks() {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12; // 輕微重力下墜感
    p.vx *= 0.985;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      fireworks.splice(i, 1);
      continue;
    }

    push();
    noStroke();
    fill(p.color[0], p.color[1], p.color[2], p.alpha);
    ellipse(p.x, p.y, p.size, p.size);
    fill(255, 255, 255, p.alpha * 0.65);
    ellipse(p.x, p.y, p.size * 0.4, p.size * 0.4);
    pop();
  }
}

function checkSelectedOption(index, char2X, char2Y) {
  if (!currentQuestion) return;
  selectedOptionIndex = index;
  if (currentQuestion.options[index] === currentQuestion.answer) {
    if (!isCurrentQuestionCorrect) {
      correctAnimStartFrame = frameCount; // 答對瞬間開始播放動作
      triggerCorrectCelebration(char2X, char2Y); // 答對瞬間放煙花
    }
    isCurrentQuestionCorrect = true;
  } else {
    isCurrentQuestionCorrect = false;
  }
}

function drawQuizBox(isNear) {
  optionBoxes = [];
  if (!isNear || !currentQuestion) return;

  const boxW = width / 3;
  const boxH = height / 2;
  const boxX = (width - boxW) / 2;
  const boxY = 16;

  push();
  fill(255, 230, 80, 90);
  stroke(180, 130, 0, 210);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 12);

  noStroke();
  fill(30);
  textAlign(CENTER, TOP);
  textSize(constrain(min(boxW * 0.08, boxH * 0.14), 16, 28));
  text("乘法選擇題", boxX + boxW / 2, boxY + boxH * 0.06);

  textSize(constrain(min(boxW * 0.11, boxH * 0.18), 20, 36));
  text(currentQuestion.text, boxX + boxW / 2, boxY + boxH * 0.18);

  const areaTop = boxY + boxH * 0.38;
  const areaH = boxH * 0.44;
  const padX = boxW * 0.06;
  const padY = areaH * 0.08;
  const gapX = boxW * 0.04;
  const gapY = areaH * 0.12;
  const optW = (boxW - padX * 2 - gapX) / 2;
  const optH = (areaH - padY * 2 - gapY) / 2;
  const labels = ["A", "B", "C", "D"];

  for (let i = 0; i < 4; i++) {
    const ox = boxX + padX + (i % 2) * (optW + gapX);
    const oy = areaTop + padY + floor(i / 2) * (optH + gapY);
    optionBoxes.push({ x: ox, y: oy, w: optW, h: optH, index: i });

    let bgCol = color(255, 255, 255, 225);
    if (selectedOptionIndex === i) {
      bgCol = currentQuestion.options[i] === currentQuestion.answer
        ? color(144, 238, 144, 240)
        : color(255, 160, 160, 240);
    }
    fill(bgCol);
    stroke(90, 90, 90, 200);
    strokeWeight(1.5);
    rect(ox, oy, optW, optH, 8);

    noStroke();
    fill(25);
    textAlign(CENTER, CENTER);
    textSize(constrain(min(optW * 0.22, optH * 0.48), 14, 24));
    text(labels[i] + ". " + currentQuestion.options[i], ox + optW / 2, oy + optH / 2);
  }

  if (selectedOptionIndex !== null) {
    const ok = currentQuestion.options[selectedOptionIndex] === currentQuestion.answer;
    fill(ok ? color(0, 128, 0) : color(190, 20, 20));
    textAlign(CENTER, BOTTOM);
    textSize(constrain(min(boxW * 0.065, boxH * 0.1), 14, 20));
    text(ok ? "答對了！" : "再試一次（答案：" + currentQuestion.answer + "）", boxX + boxW / 2, boxY + boxH - boxH * 0.04);
  }
  pop();
}

function getChar2ScreenPosition() {
  const bgAspect = bgImage && bgImage.height > 0 ? bgImage.width / bgImage.height : 1;
  const singleBgWidth = max(width, height * bgAspect);
  const characterScale = (height / 3) / frameHeight;
  const c2H = isCurrentQuestionCorrect ? char2CorrectFrameHeight : char2StopFrameHeight;
  const c2DispH = c2H * characterScale;
  return {
    x: bgOffsetX - singleBgWidth * 0.5,
    y: height - c2DispH / 2
  };
}

function preload() {
  bgImage = safeLoadImage("bg/3.png");
  characterSprite = safeLoadImage("1/stop/stop.png");
  walkSprite = safeLoadImage("1/walk/walk.png");
  magicSprite = safeLoadImage("1/magic/magic.png");
  magicEffectSprite = safeLoadImage("1/magic_effect/magic_effect.png");
  char2StopSprite = safeLoadImage("2/stop/stop.png");
  char2ActionSprite = safeLoadImage("2/actiy/actiy.png");
  char2CorrectSprite = safeLoadImage("2/actiy/actiy.png");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  characterX = (width * 2) / 3;
  frameRate(60);
}

function draw() {
  background("#87CEEB");

  const bgAspect = bgImage && bgImage.height > 0 ? bgImage.width / bgImage.height : 1;
  const singleBgWidth = max(width, height * bgAspect);
  const singleBgHeight = height;
  const minBgOffset = width - singleBgWidth * 2;
  const maxBgOffset = singleBgWidth;
  const anchorX = (width * 2) / 3;

  const movingRight = keyIsDown(RIGHT_ARROW);
  const movingLeft = keyIsDown(LEFT_ARROW);
  isWalking = movingRight || movingLeft;
  const movementStep = constrain(width * 0.004, 2, 8);
  const characterScale = (height / 3) / frameHeight;
  const characterWidth = frameWidth * characterScale;
  const characterHeight = height / 3;

  if (movingRight) {
    facingDirection = 1;
    if (characterX < anchorX) characterX = min(anchorX, characterX + movementStep);
    else if (bgOffsetX > minBgOffset) bgOffsetX = max(minBgOffset, bgOffsetX - movementStep);
    else characterX += movementStep;
  } else if (movingLeft) {
    facingDirection = -1;
    if (characterX > anchorX) characterX = max(anchorX, characterX - movementStep);
    else if (bgOffsetX < maxBgOffset) bgOffsetX = min(maxBgOffset, bgOffsetX + movementStep);
    else characterX -= movementStep;
  }

  characterX = constrain(characterX, characterWidth / 2, width - characterWidth / 2);

  if (bgImage && bgImage.width > 0) {
    push();
    imageMode(CORNER);
    for (let i = -1; i <= 1; i++) {
      image(bgImage, bgOffsetX + i * singleBgWidth, 0, singleBgWidth, singleBgHeight);
    }
    pop();
  }

  // 繪製第二角色：未答對前固定停在待機第 0 格，答對後才播放動作，且始終不消失
  const char2X = bgOffsetX - singleBgWidth * 0.5;
  const triggerDistance = (characterWidth + char2StopFrameWidth * characterScale) * 0.9;
  const isChar1Near = abs(characterX - char2X) < triggerDistance;

  if (isChar1Near && !wasChar1Near) {
    currentQuestion = generateMultiplicationQuestion();
    selectedOptionIndex = null;
    isCurrentQuestionCorrect = false;
  } else if (!isChar1Near && wasChar1Near) {
    selectedOptionIndex = null;
    isCurrentQuestionCorrect = false;
  }
  wasChar1Near = isChar1Near;

  let c2Sprite = char2StopSprite;
  let c2W = char2StopFrameWidth;
  let c2H = char2StopFrameHeight;
  let c2Idx = 0;

  if (isCurrentQuestionCorrect) {
    c2Sprite = char2CorrectSprite;
    c2W = char2CorrectFrameWidth;
    c2H = char2CorrectFrameHeight;
    const elapsedCorrectFrames = max(0, frameCount - correctAnimStartFrame);
    c2Idx = floor(elapsedCorrectFrames / 6) % char2CorrectFrameCount;
  }

  const c2DispW = c2W * characterScale;
  const c2DispH = c2H * characterScale;
  const char2Y = height - c2DispH / 2;

  if (c2Sprite && c2Sprite.width > 0) {
    push();
    translate(char2X, char2Y);
    image(c2Sprite, 0, 0, c2DispW, c2DispH, c2Idx * c2W, 0, c2W, c2H);
    pop();
  }

  if (isCasting && frameCount - magicStartFrame >= magicFrameCount * framesPerStep) {
    isCasting = false;
    activeEffects.push({
      x: characterX + (magicDirection * characterWidth) / 2,
      y: height - characterHeight * 0.58,
      direction: magicDirection
    });
  }

  const sp = isCasting ? magicSprite : isWalking ? walkSprite : characterSprite;
  const cnt = isCasting ? magicFrameCount : isWalking ? walkFrameCount : frameCountInSprite;
  const fw = isCasting ? magicFrameWidth : isWalking ? walkFrameWidth : frameWidth;
  const fh = isCasting ? magicFrameHeight : isWalking ? walkFrameHeight : frameHeight;
  const idx = isCasting
    ? floor((frameCount - magicStartFrame) / framesPerStep)
    : floor(frameCount / framesPerStep) % cnt;
  const dispW = fw * characterScale;
  const dispH = fh * characterScale;

  if (sp && sp.width > 0) {
    push();
    translate(characterX, height - dispH / 2);
    scale(isCasting ? magicDirection : facingDirection, 1);
    image(sp, 0, 0, dispW, dispH, idx * fw, 0, fw, fh);
    pop();
  }

  const effW = effectFrameWidth * characterScale;
  const effH = effectFrameHeight * characterScale;
  const effSpeed = max(6, width * 0.008);
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const ef = activeEffects[i];
    ef.x += ef.direction * effSpeed;
    if (ef.x > width || ef.x < 0) {
      activeEffects.splice(i, 1);
      continue;
    }
    const efIdx = floor(frameCount / framesPerStep) % effectFrameCount;
    if (magicEffectSprite && magicEffectSprite.width > 0) {
      push();
      translate(ef.x, ef.y);
      scale(ef.direction, 1);
      image(magicEffectSprite, 0, 0, effW, effH, efIdx * effectFrameWidth, 0, effectFrameWidth, effectFrameHeight);
      pop();
    }
  }

  // 繪製答對時放出的煙花
  updateAndDrawFireworks();

  // 繪製上方乘法選擇題方框
  drawQuizBox(isChar1Near);
}

function mousePressed() {
  if (!wasChar1Near || !currentQuestion) return;
  const pos = getChar2ScreenPosition();
  for (let i = 0; i < optionBoxes.length; i++) {
    const b = optionBoxes[i];
    if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
      checkSelectedOption(b.index, pos.x, pos.y);
      break;
    }
  }
}

function keyPressed() {
  if (wasChar1Near && currentQuestion) {
    const pos = getChar2ScreenPosition();
    if (key === "1" || key === "a" || key === "A") { checkSelectedOption(0, pos.x, pos.y); return false; }
    if (key === "2" || key === "b" || key === "B") { checkSelectedOption(1, pos.x, pos.y); return false; }
    if (key === "3" || key === "c" || key === "C") { checkSelectedOption(2, pos.x, pos.y); return false; }
    if (key === "4" || key === "d" || key === "D") { checkSelectedOption(3, pos.x, pos.y); return false; }
  }
  if (keyCode === RIGHT_ARROW) { facingDirection = 1; return false; }
  if (keyCode === LEFT_ARROW) { facingDirection = -1; return false; }
  if (keyCode === 32) {
    if (!spaceIsDown && !isCasting) {
      isCasting = true;
      magicStartFrame = frameCount;
      magicDirection = facingDirection;
    }
    spaceIsDown = true;
    return false;
  }
}

function keyReleased() {
  if (keyCode === 32) spaceIsDown = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  characterX = constrain(characterX, 1, width - 1);
}