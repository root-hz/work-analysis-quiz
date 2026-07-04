(function () {
  'use strict';

  let currentSet = null;
  let questions = [];
  let currentIndex = 0;
  let selected = new Set();
  let wrongAnswers = [];

  const $ = (sel) => document.querySelector(sel);

  const screens = {
    hub: $('#screen-hub'),
    quiz: $('#screen-quiz'),
    result: $('#screen-result'),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme || 'blue';
    const colors = {
      blue: '#2563eb',
      red: '#b91c1c',
      green: '#059669',
      purple: '#7c3aed',
      amber: '#d97706',
    };
    const color = colors[theme] || colors.blue;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }

  function renderHub() {
    const container = $('#quiz-cards');
    container.innerHTML = '';

    Object.values(window.QUIZ_SETS).forEach((set) => {
      const card = document.createElement('button');
      card.className = `quiz-card quiz-card-${set.theme}`;
      card.type = 'button';
      card.innerHTML = `
        <div class="card-icon">${set.icon}</div>
        <div class="card-body">
          <h2>${set.title}</h2>
          <p>${set.subtitle}</p>
          <ul>${set.info.map((line) => `<li>${line}</li>`).join('')}</ul>
        </div>
        <span class="card-action">开始答题 →</span>`;
      card.addEventListener('click', () => startQuiz(set.id));
      container.appendChild(card);
    });
  }

  function startQuiz(setId) {
    currentSet = window.QUIZ_SETS[setId];
    if (!currentSet) return;

    questions = currentSet.questions() || [];
    applyTheme(currentSet.theme);
    document.title = `${currentSet.title} · 即测即评`;
    $('#quiz-title').textContent = currentSet.title;
    restart();
  }

  function normalizeMulti(str) {
    return str.toUpperCase().split('').filter((c) => /[A-H]/.test(c)).sort().join('');
  }

  function judgeKeyFromText(text) {
    if (text === '正确') return '对';
    if (text === '错误') return '错';
    return text;
  }

  function formatAnswer(q) {
    if (q.type === '判断题') {
      return q.answer === '对' ? '正确' : '错误';
    }
    if (q.type === '多选题') {
      return q.answer.split('').map((k) => {
        const opt = q.options.find((o) => o.key === k);
        return opt ? `${k}. ${opt.text}` : k;
      }).join('；');
    }
    const opt = q.options.find((o) => o.key === q.answer);
    return opt ? `${q.answer}. ${opt.text}` : q.answer;
  }

  function formatUserAnswer(q, sel) {
    if (q.type === '判断题') {
      const key = [...sel][0];
      const opt = q.options.find((o) => o.key === key);
      return opt ? opt.text : key;
    }
    if (q.type === '多选题') {
      const keys = [...sel].sort();
      return keys.map((k) => {
        const opt = q.options.find((o) => o.key === k);
        return opt ? `${k}. ${opt.text}` : k;
      }).join('；') || '（未选择）';
    }
    const key = [...sel][0];
    const opt = q.options.find((o) => o.key === key);
    return opt ? `${key}. ${opt.text}` : key;
  }

  function isCorrect(q, sel) {
    if (q.type === '判断题') {
      const key = [...sel][0];
      const opt = q.options.find((o) => o.key === key);
      if (!opt) return false;
      return judgeKeyFromText(opt.text) === q.answer;
    }
    if (q.type === '多选题') {
      const user = normalizeMulti([...sel].join(''));
      const correct = normalizeMulti(q.answer);
      return user === correct;
    }
    return [...sel][0] === q.answer;
  }

  function renderQuestion() {
    const q = questions[currentIndex];
    selected = new Set();

    const pct = (currentIndex / questions.length) * 100;
    $('#progress-fill').style.width = `${pct}%`;
    $('#progress-text').textContent = `${currentIndex + 1} / ${questions.length}`;
    $('#q-type').textContent = q.type;
    $('#q-chapter').textContent = q.chapter;
    $('#q-stem').textContent = `${currentIndex + 1}. ${q.stem}`;

    const container = $('#options');
    container.innerHTML = '';

    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.key = opt.key;

      if (q.type === '判断题') {
        btn.classList.add('option-judge');
        btn.innerHTML = `<span class="opt-text">${opt.text}</span>`;
      } else {
        btn.innerHTML = `<span class="opt-key">${opt.key}</span><span class="opt-text">${opt.text}</span>`;
      }

      btn.addEventListener('click', () => onOptionClick(q, opt.key, btn));
      container.appendChild(btn);
    });

    $('#btn-submit').disabled = true;
  }

  function onOptionClick(q, key, btn) {
    if (q.type === '多选题') {
      if (selected.has(key)) {
        selected.delete(key);
        btn.classList.remove('selected');
      } else {
        selected.add(key);
        btn.classList.add('selected');
      }
    } else {
      selected = new Set([key]);
      document.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    }
    $('#btn-submit').disabled = selected.size === 0;
  }

  function submitAnswer() {
    const q = questions[currentIndex];
    const correct = isCorrect(q, selected);

    if (correct) {
      showCorrectToast(() => goNext());
    } else {
      wrongAnswers.push({
        id: q.id,
        type: q.type,
        chapter: q.chapter,
        stem: q.stem,
        userAnswer: formatUserAnswer(q, selected),
        correctAnswer: formatAnswer(q),
      });
      $('#wrong-user-answer').textContent = formatUserAnswer(q, selected);
      $('#wrong-correct-answer').textContent = formatAnswer(q);
      $('#modal-wrong').classList.remove('hidden');
    }
  }

  function showCorrectToast(cb) {
    const toast = $('#toast-correct');
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    void toast.offsetWidth;
    toast.style.animation = '';
    setTimeout(() => {
      toast.classList.add('hidden');
      cb();
    }, 1200);
  }

  function goNext() {
    currentIndex++;
    if (currentIndex >= questions.length) {
      showResult();
    } else {
      renderQuestion();
    }
  }

  function showResult() {
    const total = questions.length;
    const wrong = wrongAnswers.length;
    const correct = total - wrong;
    const score = Math.round((correct / total) * 100);

    $('#result-score').textContent = score;
    $('#result-summary').textContent = `共 ${total} 题，答对 ${correct} 题，答错 ${wrong} 题`;
    $('#result-set-name').textContent = currentSet ? currentSet.title : '';

    const wrongSection = $('#wrong-section');
    const perfectMsg = $('#perfect-msg');

    if (wrong === 0) {
      wrongSection.classList.add('hidden');
      perfectMsg.classList.remove('hidden');
    } else {
      perfectMsg.classList.add('hidden');
      wrongSection.classList.remove('hidden');
      $('#wrong-count').textContent = wrong;

      const list = $('#wrong-list');
      list.innerHTML = '';
      wrongAnswers.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'wrong-item';
        div.innerHTML = `
          <div class="wi-num">第 ${item.id} 题 · ${item.type} · ${item.chapter}</div>
          <div class="wi-stem">${item.stem}</div>
          <div class="wi-answers">
            <div class="wi-wrong">你的答案：${item.userAnswer}</div>
            <div class="wi-right">正确答案：${item.correctAnswer}</div>
          </div>`;
        list.appendChild(div);
      });
    }

    showScreen('result');
  }

  function restart() {
    currentIndex = 0;
    wrongAnswers = [];
    selected = new Set();
    $('#modal-wrong').classList.add('hidden');
    renderQuestion();
    showScreen('quiz');
  }

  function getQuizFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('quiz');
    if (queryId && window.QUIZ_SETS[queryId]) return queryId;

    const hashId = window.location.hash.replace('#', '');
    if (hashId && window.QUIZ_SETS[hashId]) return hashId;

    return null;
  }

  $('#btn-submit').addEventListener('click', submitAnswer);

  $('#btn-wrong-next').addEventListener('click', () => {
    $('#modal-wrong').classList.add('hidden');
    goNext();
  });

  $('#btn-restart').addEventListener('click', () => {
    if (currentSet) startQuiz(currentSet.id);
  });

  $('#btn-back-hub').addEventListener('click', () => {
    document.title = '习题集 · 即测即评';
    applyTheme('blue');
    showScreen('hub');
  });

  $('#btn-back-hub-result').addEventListener('click', () => {
    document.title = '习题集 · 即测即评';
    applyTheme('blue');
    showScreen('hub');
  });

  renderHub();

  const autoStart = getQuizFromUrl();
  if (autoStart) startQuiz(autoStart);

})();
