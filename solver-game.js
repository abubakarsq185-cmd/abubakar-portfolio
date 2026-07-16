/*
  Problem Solver Arena - Abubakar Portfolio
  6 brain challenges with progressive scoring
*/

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const STORAGE_KEY = 'abubakar_solver_arena_v1';

const LEVELS = [
  {
    id: 'logic',
    icon: '⋏',
    title: 'Logic Lock',
    short: 'Toggle inputs to match target output',
    desc: 'You’re given a Boolean circuit. Toggle A, B, C to make the final output match the target. Teaches AND, OR, NOT thinking.',
    diff: 'Easy',
    color: 'teal'
  },
  {
    id: 'pattern',
    icon: '◍',
    title: 'Pattern Matrix',
    short: 'Find the missing number in sequence',
    desc: 'Analyze numeric patterns — arithmetic, geometric, squares, primes, Fibonacci. Enter the next value.',
    diff: 'Medium',
    color: 'amber'
  },
  {
    id: 'debug',
    icon: '</>',
    title: 'Debug Dash',
    short: 'Spot and fix the Python bug',
    desc: 'A Python snippet has a subtle bug. Choose the correct fix. Trains code review and debugging speed.',
    diff: 'Medium',
    color: 'violet'
  },
  {
    id: 'knap',
    icon: '◧',
    title: 'Resource Optimizer',
    short: 'Maximize profit within limited energy',
    desc: 'Classic knapsack / resource allocation. You have 15 energy units. Pick projects to maximize profit without overloading.',
    diff: 'Hard',
    color: 'green'
  },
  {
    id: 'maze',
    icon: '▦',
    title: 'Neural Path',
    short: 'Find shortest path through the grid',
    desc: 'Navigate from S to E avoiding corrupted nodes. Use minimal steps. Tests pathfinding intuition.',
    diff: 'Hard',
    color: 'teal'
  },
  {
    id: 'hanoi',
    icon: '⟁',
    title: 'Tower of Logic',
    short: 'Move the stack in minimal moves',
    desc: 'Tower of Hanoi with 4 disks. Move entire tower from left to right. You cannot place larger disk on smaller.',
    diff: 'Expert',
    color: 'amber'
  },
];

// PATTERN PUZZLES DATABASE
const PATTERNS = [
  { seq: [2,6,12,20,30], ans: 42, hint: 'Pattern is n*(n+1): 1×2=2, 2×3=6, 3×4=12...', rule: 'n × (n+1)'},
  { seq: [1,1,2,3,5,8], ans: 13, hint: 'Each number is sum of previous two', rule: 'Fibonacci: a(n)=a(n-1)+a(n-2)'},
  { seq: [2,3,5,7,11,13], ans: 17, hint: 'These are prime numbers in order', rule: 'Prime sequence'},
  { seq: [1,4,9,16,25], ans: 36, hint: 'Squares of natural numbers', rule: 'n²'},
  { seq: [3,6,12,24,48], ans: 96, hint: 'Each term doubles', rule: '×2 geometric'},
  { seq: [81,27,9,3], ans: 1, hint: 'Divide by 3 each time', rule: '÷3'},
  { seq: [1,3,6,10,15], ans: 21, hint: 'Triangular numbers: +2,+3,+4,+5...', rule: 'Triangular +n'},
  { seq: [2,6,12,36,72], ans: 216, hint: '×3, ×2 repeating', rule: '×3, ×2 alternating'},
  { seq: [5,11,23,47], ans: 95, hint: '×2+1 each step', rule: 'a*2+1'},
  { seq: [10,20,30,40], ans: 50, hint: 'Add 10', rule: 'Arithmetic +10'},
  { seq: [1,2,4,8,16], ans: 32, hint: 'Powers of 2', rule: '2^n'},
  { seq: [100,90,70,40], ans: 0, hint: 'Subtract 10,20,30...', rule: '-10,-20,-30,-40'},
  { seq: [4,9,16,25,36], ans: 49, hint: 'Square numbers starting from 2²', rule: 'n² from 2'},
  { seq: [7,14,28,56], ans: 112, hint: 'Double each time', rule: '×2'},
  { seq: [0,1,1,2,3,5,8], ans: 13, hint: 'Fibonacci starting at 0', rule: 'Fibonacci'},
];

// DEBUG CHALLENGES
const DEBUGS = [
  {
    title: 'Off-by-One Loop',
    lang: 'Python',
    code: `def sum_first_n(n):
    total = 0
    for i in range(n):  # should include n
        total += i
    return total

print(sum_first_n(5)) # Expected 15, got 10`,
    bugLine: 2,
    options: [
      'Change range(n) to range(n+1)',
      'Change total = 0 to total = 1',
      'Change total += i to total += i+1',
    ],
    correct: 0,
    explain: 'range(n) stops at n-1. To include n, use range(n+1) or range(1, n+1).'
  },
  {
    title: 'Mutable Default Arg',
    lang: 'Python',
    code: `def add_item(item, my_list=[]):
    my_list.append(item)
    return my_list

print(add_item("a")) # ["a"]
print(add_item("b")) # Expected ["b"], got ["a","b"]`,
    bugLine: 0,
    options: [
      'Use my_list=None and create new list inside',
      'Use my_list = list() in loop',
      'Return my_list.copy()',
    ],
    correct: 0,
    explain: 'Mutable defaults are shared across calls. Use None and initialize inside.'
  },
  {
    title: 'String vs Int',
    lang: 'Python',
    code: `age = input("Enter age: ") # user enters 25
next_year = age + 1
print(f"Next year you will be {next_year}") 
# TypeError!`,
    bugLine: 1,
    options: [
      'next_year = int(age) + 1',
      'next_year = age + "1"',
      'age = input + 1',
    ],
    correct: 0,
    explain: 'input() returns string. Convert to int before math.'
  },
  {
    title: 'Missing Return',
    lang: 'Python',
    code: `def is_even(num):
    if num % 2 == 0:
        return True
    # missing return for odd case

result = is_even(3)
if result == False:
    print("Odd") # never prints correctly`,
    bugLine: 3,
    options: [
      'Add else: return False',
      'Add return True at end',
      'Change if to while',
    ],
    correct: 0,
    explain: 'Function returns None implicitly if no return, which is not False.'
  },
  {
    title: 'Comparison Bug',
    lang: 'Python',
    code: `status = "active"
if status = "active":  # SyntaxError
    print("User is active")`,
    bugLine: 1,
    options: [
      'if status == "active":',
      'if status is = "active":',
      'if (status = "active"):',
    ],
    correct: 0,
    explain: 'Assignment = vs comparison ==. Python needs == for comparison.'
  },
  {
    title: 'KeyError Risk',
    lang: 'Python',
    code: `user = {"name": "Ali", "age": 22}
print(user["email"]) # KeyError if missing`,
    bugLine: 1,
    options: [
      'print(user.get("email", "No email"))',
      'print(user["email"] or "No email")',
      'print(user.email)',
    ],
    correct: 0,
    explain: 'Use dict.get() with default to avoid KeyError.'
  },
];

// KNAPSACK TASK TEMPLATES
const TASK_TEMPLATES = [
  { title: 'API Automation', icon: '⚡', baseCost: [3,5], baseProfit:[25,40] },
  { title: 'Poster Design', icon: '🎨', baseCost: [2,4], baseProfit:[15,30] },
  { title: 'Research Report', icon: '📊', baseCost: [4,6], baseProfit:[30,50] },
  { title: 'Client Call', icon: '📞', baseCost: [1,3], baseProfit:[10,20] },
  { title: 'Model Training', icon: '🧠', baseCost: [5,7], baseProfit:[35,60] },
  { title: 'Landing Page', icon: '💻', baseCost: [3,5], baseProfit:[22,38] },
  { title: 'Data Cleanup', icon: '🧹', baseCost: [2,3], baseProfit:[12,22] },
  { title: 'Ad Campaign', icon: '📣', baseCost: [4,5], baseProfit:[28,45] },
];

class SolverArena {
  constructor() {
    this.current = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.hintsUsed = 0;
    this.totalSolved = 0;
    this.completed = new Set();
    this.timer = null;
    this.seconds = 0;
    this.levelStates = {};

    // level-specific states
    this.logicState = { A:false, B:false, C:false, exprIndex:0, target:true };
    this.patternState = { puzzleIndex:0, attempts:0 };
    this.debugState = { challengeIndex:0, solved: new Set() };
    this.knapState = { tasks:[], selected:new Set(), capacity:15 };
    this.mazeState = { grid:[], player:{x:0,y:0}, moves:0, size:6 };
    this.hanoiState = { pegs:[[4,3,2,1],[],[]], fromPeg:null, moves:0, min:15 };

    this.expressions = [
      { label: "(A AND B) OR (NOT C)", fn: ({A,B,C}) => (A && B) || (!C) },
      { label: "(A OR B) AND C", fn: ({A,B,C}) => (A || B) && C },
      { label: "NOT (A AND B) OR C", fn: ({A,B,C}) => !(A && B) || C },
      { label: "A AND (B OR NOT C)", fn: ({A,B,C}) => A && (B || !C) },
      { label: "(A XOR B) AND C", fn: ({A,B,C}) => (A !== B) && C },
      { label: "NOT A OR (B AND C)", fn: ({A,B,C}) => (!A) || (B && C) },
    ];

    this.load();
    this.cacheDOM();
    this.bind();
    this.renderSidebar();
    this.renderLevel(0);
    this.startTimer();
  }

  cacheDOM() {
    this.elScore = $('#statScore');
    this.elStreak = $('#statStreak');
    this.elSolved = $('#statSolved');
    this.elTime = $('#statTime');
    this.elLevelName = $('#statLevelName');
    this.elLevelList = $('#levelList');
    this.elBoardTitle = $('#boardTitle');
    this.elBoardDesc = $('#boardDesc');
    this.elBoardContent = $('#boardContent');
    this.elFeedback = $('#feedback');
    this.elModal = $('#winModal');
  }

  bind() {
    $('#btnHint')?.addEventListener('click', () => this.showHint());
    $('#btnSkip')?.addEventListener('click', () => this.skipLevel());
    $('#btnReset')?.addEventListener('click', () => this.resetCurrent());
    $('#modalNext')?.addEventListener('click', () => this.nextLevel());
    $('#modalReplay')?.addEventListener('click', () => { this.hideModal(); this.resetCurrent(); });
    $('#modalClose')?.addEventListener('click', () => this.hideModal());

    document.addEventListener('keydown', (e) => {
      if (this.current === 4) { // maze
        if (e.key === 'ArrowUp' || e.key==='w') this.movePlayer(0,-1);
        if (e.key === 'ArrowDown' || e.key==='s') this.movePlayer(0,1);
        if (e.key === 'ArrowLeft' || e.key==='a') this.movePlayer(-1,0);
        if (e.key === 'ArrowRight' || e.key==='d') this.movePlayer(1,0);
      }
    });
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.score = data.score||0;
      this.bestStreak = data.bestStreak||0;
      this.streak = data.streak||0;
      this.totalSolved = data.totalSolved||0;
      this.completed = new Set(data.completed||[]);
      this.current = data.current||0;
    } catch {}
  }

  save() {
    const data = {
      score: this.score,
      bestStreak: this.bestStreak,
      streak: this.streak,
      totalSolved: this.totalSolved,
      completed: [...this.completed],
      current: this.current
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.seconds++;
      if (this.elTime) this.elTime.textContent = `${Math.floor(this.seconds/60)}:${String(this.seconds%60).padStart(2,'0')}`;
    }, 1000);
  }

  renderSidebar() {
    if (!this.elLevelList) return;
    this.elLevelList.innerHTML = '';
    LEVELS.forEach((lvl, idx) => {
      const isCompleted = this.completed.has(lvl.id);
      const isLocked = idx > 0 && !this.completed.has(LEVELS[idx-1].id) && idx !== this.current;
      const btn = document.createElement('button');
      btn.className = `level-item ${idx===this.current?'active':''} ${isCompleted?'completed':''} ${isLocked?'locked':''}`;
      btn.innerHTML = `
        <div class="level-icon">${lvl.icon}</div>
        <div class="level-meta">
          <h5>${String(idx+1).padStart(2,'0')} ${lvl.title}</h5>
          <p>${lvl.short}</p>
        </div>
        <div class="level-status">${isCompleted?'<span class="status-done">✓ Done</span>': lvl.diff}</div>
      `;
      btn.addEventListener('click', () => {
        if (!isLocked) this.renderLevel(idx);
      });
      this.elLevelList.appendChild(btn);
    });
    this.updateStats();
  }

  updateStats() {
    if (this.elScore) this.elScore.textContent = this.score;
    if (this.elStreak) this.elStreak.textContent = `${this.streak} 🔥`;
    if (this.elSolved) this.elSolved.textContent = `${this.totalSolved}/${LEVELS.length}`;
    if (this.elLevelName) this.elLevelName.textContent = LEVELS[this.current]?.title || '-';
  }

  renderLevel(index) {
    this.current = index;
    const lvl = LEVELS[index];
    if (!lvl) return;

    // reset per level UI
    this.elBoardTitle.textContent = lvl.title;
    this.elBoardDesc.textContent = lvl.desc;
    this.elBoardContent.innerHTML = '';
    this.hideFeedback();
    this.renderSidebar();
    this.updateStats();

    // Dispatch to specific renderer
    switch(lvl.id) {
      case 'logic': this.renderLogic(); break;
      case 'pattern': this.renderPattern(); break;
      case 'debug': this.renderDebug(); break;
      case 'knap': this.renderKnap(); break;
      case 'maze': this.renderMaze(); break;
      case 'hanoi': this.renderHanoi(); break;
    }
    this.save();
  }

  showFeedback(msg, type='info') {
    if (!this.elFeedback) return;
    this.elFeedback.textContent = msg;
    this.elFeedback.className = `feedback show ${type}`;
  }
  hideFeedback() {
    if (!this.elFeedback) return;
    this.elFeedback.className = 'feedback';
  }

  // ========= LOGIC LOCK =========
  renderLogic() {
    // new puzzle each render unless exists
    const exprIdx = Math.floor(Math.random()*this.expressions.length);
    this.logicState = {
      A: Math.random()>0.5,
      B: Math.random()>0.5,
      C: Math.random()>0.5,
      exprIndex: exprIdx,
      target: Math.random()>0.5
    };
    const expr = this.expressions[exprIdx];

    const wrap = document.createElement('div');
    wrap.className = 'logic-circuit';
    wrap.innerHTML = `
      <div class="target-display">
        <div><strong>Target Output</strong><div style="font-size:0.8rem;color:var(--muted)">Make circuit output match this</div></div>
        <div class="target-bool ${this.logicState.target?'true':'false'}">${this.logicState.target?'TRUE':'FALSE'}</div>
      </div>
      <div class="switches" id="switches"></div>
      <div class="expression-box" id="exprBox">
        <div id="exprLabel">${expr.label}</div>
        <div class="expr-output">
          <span>Current Output:</span>
          <span id="currOutput" class="mini-bool"></span>
          <span id="matchIcon"></span>
        </div>
      </div>
      <div class="pattern-hint">
        💡 Boolean logic: AND needs both true, OR needs one true, NOT flips the value. XOR true when inputs differ.
      </div>
    `;
    this.elBoardContent.appendChild(wrap);

    const switchesContainer = $('#switches', wrap);
    ['A','B','C'].forEach(k => {
      const div = document.createElement('div');
      div.className = `switch ${this.logicState[k]?'active':''}`;
      div.innerHTML = `<div class="label">INPUT ${k}</div><div class="value">${this.logicState[k]?'1':'0'}</div><div class="state">${this.logicState[k]?'TRUE':'FALSE'}</div>`;
      div.addEventListener('click', () => {
        this.logicState[k] = !this.logicState[k];
        div.classList.toggle('active', this.logicState[k]);
        div.querySelector('.value').textContent = this.logicState[k]?'1':'0';
        div.querySelector('.state').textContent = this.logicState[k]?'TRUE':'FALSE';
        this.updateLogicOutput();
      });
      switchesContainer.appendChild(div);
    });

    this.updateLogicOutput();
  }

  updateLogicOutput() {
    const expr = this.expressions[this.logicState.exprIndex];
    const result = expr.fn(this.logicState);
    const outEl = $('#currOutput');
    const iconEl = $('#matchIcon');
    if (!outEl) return;
    outEl.textContent = result?'TRUE':'FALSE';
    outEl.className = `mini-bool target-bool ${result?'true':'false'}`;
    if (result === this.logicState.target) {
      iconEl.textContent = '✓ Match!';
      iconEl.style.color = 'var(--green)';
      this.showFeedback('Circuit matched! Well done.', 'success');
      setTimeout(()=> this.winLevel(100), 600);
    } else {
      iconEl.textContent = '✕ No match';
      iconEl.style.color = 'var(--amber)';
      this.hideFeedback();
    }
  }

  // ========= PATTERN =========
  renderPattern() {
    const idx = Math.floor(Math.random()*PATTERNS.length);
    this.patternState.puzzleIndex = idx;
    this.patternState.attempts = 0;
    const pz = PATTERNS[idx];

    const card = document.createElement('div');
    card.className = 'pattern-card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <strong>Sequence #${idx+1}</strong>
        <span style="font-size:0.8rem;color:var(--muted);padding:6px 10px;border:1px solid rgba(247,243,234,0.1);border-radius:20px">${pz.rule}</span>
      </div>
      <div class="sequence" id="seqRow"></div>
      <div class="pattern-input-row">
        <span style="font-weight:800">Next =</span>
        <input type="number" id="patternInput" placeholder="?" autocomplete="off" />
        <button class="btn-game primary" id="patternSubmit">Submit</button>
      </div>
      <div class="pattern-hint" id="patternHint">Attempts: 0 • Type the missing number and press Enter</div>
    `;
    this.elBoardContent.appendChild(card);

    const seqRow = $('#seqRow', card);
    pz.seq.forEach(v => {
      const d = document.createElement('div');
      d.className='seq-item';
      d.textContent = v;
      seqRow.appendChild(d);
    });
    const mystery = document.createElement('div');
    mystery.className='seq-item mystery';
    mystery.textContent='?';
    seqRow.appendChild(mystery);

    $('#patternSubmit', card).addEventListener('click', () => this.checkPattern());
    $('#patternInput', card).addEventListener('keydown', (e) => {
      if (e.key==='Enter') this.checkPattern();
    });
  }

  checkPattern() {
    const input = $('#patternInput');
    const pz = PATTERNS[this.patternState.puzzleIndex];
    if (!input) return;
    const val = Number(input.value);
    if (Number.isNaN(val) || input.value==='') {
      this.showFeedback('Enter a valid number', 'error');
      return;
    }
    this.patternState.attempts++;
    $('#patternHint').textContent = `Attempts: ${this.patternState.attempts} • Previous: ${val}`;
    if (val === pz.ans) {
      this.showFeedback(`Correct! Rule: ${pz.rule}. ${pz.hint}`, 'success');
      const bonus = Math.max(20, 100 - this.patternState.attempts*15);
      setTimeout(()=> this.winLevel(100+bonus), 700);
    } else {
      this.showFeedback(val > pz.ans ? 'Too high! Try smaller.' : 'Too low! Try larger.', 'error');
      input.select();
    }
  }

  // ========= DEBUG =========
  renderDebug() {
    const chIdx = this.debugState.challengeIndex % DEBUGS.length;
    const ch = DEBUGS[chIdx];

    const card = document.createElement('div');
    card.innerHTML = `
      <div class="debug-card">
        <div class="debug-head">
          <span>🐍 ${ch.title} • ${ch.lang}</span>
          <span>Bug on line ${ch.bugLine+1}</span>
        </div>
        <pre class="debug-code" id="debugCode"></pre>
      </div>
      <div class="options-grid" id="optionsGrid"></div>
      <div class="pattern-hint" style="margin-top:14px">Select the correct fix. Each bug teaches a real Python pitfall.</div>
    `;
    this.elBoardContent.appendChild(card);

    const codeEl = $('#debugCode', card);
    ch.code.split('\n').forEach((line, i) => {
      const span = document.createElement('span');
      span.textContent = line + '\n';
      if (i===ch.bugLine) span.className='line-error';
      codeEl.appendChild(span);
    });

    const optGrid = $('#optionsGrid', card);
    ch.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className='option-btn';
      btn.textContent = `${String.fromCharCode(65+i)}. ${opt}`;
      btn.addEventListener('click', () => this.checkDebug(i, btn));
      optGrid.appendChild(btn);
    });
  }

  checkDebug(choice, btnEl) {
    const ch = DEBUGS[this.debugState.challengeIndex % DEBUGS.length];
    const isRight = choice===ch.correct;
    $$('.option-btn').forEach(b=>{
      b.disabled=true;
      if (b.textContent.startsWith(String.fromCharCode(65+ch.correct))) b.classList.add('correct');
    });
    if (isRight) {
      btnEl.classList.add('correct');
      this.showFeedback(`✅ Correct! ${ch.explain}`, 'success');
      setTimeout(()=> this.winLevel(120), 800);
    } else {
      btnEl.classList.add('wrong');
      this.showFeedback(`❌ Not quite. ${ch.explain}`, 'error');
      setTimeout(()=> {
        $$('.option-btn').forEach(b=>b.disabled=false);
        this.hideFeedback();
      }, 2500);
    }
  }

  // ========= KNAPSACK =========
  renderKnap() {
    // generate tasks
    const count = 5;
    this.knapState.tasks = [];
    this.knapState.selected = new Set();
    const shuffled = [...TASK_TEMPLATES].sort(()=>0.5-Math.random()).slice(0,count);
    shuffled.forEach(t => {
      const cost = Math.floor(Math.random()*(t.baseCost[1]-t.baseCost[0]+1))+t.baseCost[0];
      const profit = Math.floor(Math.random()*(t.baseProfit[1]-t.baseProfit[0]+1))+t.baseProfit[0];
      this.knapState.tasks.push({ ...t, cost, profit, id: Math.random().toString(36).slice(2,7) });
    });

    const optimal = this.computeOptimalKnap(this.knapState.tasks, this.knapState.capacity);
    this.knapState.optimalProfit = optimal.profit;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="knap-grid" id="knapGrid"></div>
      <div class="knap-summary">
        <div>
          <div style="font-weight:900">Energy Used: <span id="knapCost">0</span> / ${this.knapState.capacity}</div>
          <div class="progress-bar"><div class="progress-fill" id="knapBar" style="width:0%"></div></div>
          <div style="margin-top:10px;font-size:0.9rem;color:var(--muted)">Profit: <strong id="knapProfit" style="color:var(--ink)">0</strong> • Optimal is <strong id="knapOptimal">${optimal.profit}</strong></div>
        </div>
        <button class="btn-game primary" id="knapCheck">Lock In Profit</button>
      </div>
    `;
    this.elBoardContent.appendChild(wrap);

    const grid = $('#knapGrid', wrap);
    this.knapState.tasks.forEach((task, idx) => {
      const card = document.createElement('div');
      card.className='task-card';
      card.innerHTML = `
        <div class="task-cost">${task.cost} energy • ${task.icon}</div>
        <div class="task-title">${task.title}</div>
        <div class="task-stats"><span>💰 ${task.profit}</span><span>Ratio ${(task.profit/task.cost).toFixed(1)}</span></div>
      `;
      card.addEventListener('click', () => {
        if (this.knapState.selected.has(idx)) this.knapState.selected.delete(idx);
        else this.knapState.selected.add(idx);
        card.classList.toggle('selected', this.knapState.selected.has(idx));
        this.updateKnapSummary();
      });
      grid.appendChild(card);
    });

    $('#knapCheck', wrap).addEventListener('click', () => this.checkKnap());
    this.updateKnapSummary();
  }

  computeOptimalKnap(tasks, cap) {
    let bestProfit = 0;
    let bestSet = [];
    const n = tasks.length;
    for (let mask=0; mask < (1<<n); mask++) {
      let cost=0, profit=0;
      let set=[];
      for (let i=0;i<n;i++) if (mask>>i &1) { cost+=tasks[i].cost; profit+=tasks[i].profit; set.push(i); }
      if (cost<=cap && profit>bestProfit) { bestProfit=profit; bestSet=set; }
    }
    return { profit: bestProfit, set: bestSet };
  }

  updateKnapSummary() {
    let cost=0, profit=0;
    this.knapState.tasks.forEach((t,i)=>{ if (this.knapState.selected.has(i)) { cost+=t.cost; profit+=t.profit; } });
    $('#knapCost').textContent = cost;
    $('#knapProfit').textContent = profit;
    $('#knapBar').style.width = `${Math.min(100, cost/this.knapState.capacity*100)}%`;
    if (cost>this.knapState.capacity) {
      $('#knapBar').style.background='linear-gradient(90deg,#ff6b6b,#e0a756)';
      this.showFeedback('Over capacity! Deselect some tasks.', 'error');
    } else {
      $('#knapBar').style.background='linear-gradient(90deg,var(--teal),var(--amber))';
      this.hideFeedback();
    }
  }

  checkKnap() {
    let cost=0, profit=0;
    this.knapState.tasks.forEach((t,i)=>{ if (this.knapState.selected.has(i)) { cost+=t.cost; profit+=t.profit; } });
    if (cost>this.knapState.capacity) { this.showFeedback('You are over energy limit!', 'error'); return; }
    if (profit >= this.knapState.optimalProfit) {
      this.showFeedback(`Perfect optimization! Profit ${profit} is optimal.`, 'success');
      setTimeout(()=> this.winLevel(150+profit), 800);
    } else {
      const diff = this.knapState.optimalProfit - profit;
      this.showFeedback(`Good effort! Profit ${profit}. You are ${diff} away from optimal ${this.knapState.optimalProfit}. Try again.`, 'error');
    }
  }

  // ========= MAZE =========
  renderMaze() {
    this.generateMaze(this.mazeState.size);
    const wrap = document.createElement('div');
    wrap.className='maze-wrap';
    wrap.innerHTML = `
      <div class="maze-grid" id="mazeGrid" style="grid-template-columns:repeat(${this.mazeState.size},48px)"></div>
      <div class="maze-controls">
        <button class="ctrl-btn" data-dir="up">↑</button>
        <div style="display:flex;gap:10px">
          <button class="ctrl-btn" data-dir="left">←</button>
          <button class="ctrl-btn" data-dir="down">↓</button>
          <button class="ctrl-btn" data-dir="right">→</button>
        </div>
      </div>
      <div style="text-align:center;color:var(--muted);font-size:0.9rem">
        Use WASD / Arrows or buttons. Moves: <strong id="mazeMoves" style="color:var(--ink)">0</strong> • Optimal: <strong id="mazeOptimal" style="color:var(--ink)">-</strong>
      </div>
    `;
    this.elBoardContent.appendChild(wrap);

    // optimal path
    const optimal = this.bfsShortest(this.mazeState.grid, {x:0,y:0}, {x:this.mazeState.size-1,y:this.mazeState.size-1});
    this.mazeState.optimal = optimal ? optimal.length-1 : 0;
    $('#mazeOptimal').textContent = this.mazeState.optimal;

    this.drawMaze();

    $$('.ctrl-btn', wrap).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const d = btn.dataset.dir;
        if (d==='up') this.movePlayer(0,-1);
        if (d==='down') this.movePlayer(0,1);
        if (d==='left') this.movePlayer(-1,0);
        if (d==='right') this.movePlayer(1,0);
      });
    });
  }

  generateMaze(size) {
    // start with all empty, add walls randomly ensuring path exists
    let attempts=0;
    while(attempts<100) {
      const grid = Array(size).fill(0).map(()=>Array(size).fill(0));
      // place walls 28%
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        if ((x===0&&y===0)||(x===size-1&&y===size-1)) continue;
        if (Math.random()<0.28) grid[y][x]=1;
      }
      const path = this.bfsShortest(grid, {x:0,y:0}, {x:size-1,y:size-1});
      if (path && path.length>= size+2) { // ensure not too trivial
        this.mazeState.grid = grid;
        this.mazeState.player = {x:0,y:0};
        this.mazeState.moves = 0;
        return;
      }
      attempts++;
    }
    // fallback empty
    this.mazeState.grid = Array(size).fill(0).map(()=>Array(size).fill(0));
    this.mazeState.player = {x:0,y:0};
    this.mazeState.moves = 0;
  }

  bfsShortest(grid, start, end) {
    const size = grid.length;
    const q = [[start]];
    const visited = Array(size).fill(0).map(()=>Array(size).fill(false));
    visited[start.y][start.x]=true;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){
      const path = q.shift();
      const cur = path[path.length-1];
      if (cur.x===end.x && cur.y===end.y) return path;
      for (let [dx,dy] of dirs) {
        const nx=cur.x+dx, ny=cur.y+dy;
        if (nx>=0&&nx<size&&ny>=0&&ny<size && !visited[ny][nx] && grid[ny][nx]===0) {
          visited[ny][nx]=true;
          q.push([...path,{x:nx,y:ny}]);
        }
      }
    }
    return null;
  }

  drawMaze() {
    const gridEl = $('#mazeGrid');
    if (!gridEl) return;
    gridEl.innerHTML='';
    const size = this.mazeState.size;
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const cell = document.createElement('div');
      cell.className='maze-cell';
      if (x===0&&y===0) { cell.classList.add('start'); cell.textContent='S'; }
      else if (x===size-1&&y===size-1) { cell.classList.add('end'); cell.textContent='E'; }
      else if (this.mazeState.grid[y][x]===1) cell.classList.add('wall');
      if (this.mazeState.player.x===x && this.mazeState.player.y===y) {
        cell.classList.add('player');
        cell.textContent='●';
      }
      gridEl.appendChild(cell);
    }
    const movesEl = $('#mazeMoves');
    if (movesEl) movesEl.textContent = this.mazeState.moves;
  }

  movePlayer(dx,dy) {
    if (this.current!==4) return;
    const np = { x: this.mazeState.player.x+dx, y: this.mazeState.player.y+dy };
    const size = this.mazeState.size;
    if (np.x<0||np.x>=size||np.y<0||np.y>=size) return;
    if (this.mazeState.grid[np.y][np.x]===1) {
      this.showFeedback('Blocked! That node is corrupted.', 'error');
      return;
    }
    this.mazeState.player = np;
    this.mazeState.moves++;
    this.drawMaze();
    this.hideFeedback();
    if (np.x===size-1 && np.y===size-1) {
      const efficiency = Math.max(0, this.mazeState.optimal ? (this.mazeState.optimal / this.mazeState.moves) : 0);
      const bonus = Math.floor(efficiency*100);
      this.showFeedback(`Reached target in ${this.mazeState.moves} moves! Optimal is ${this.mazeState.optimal}.`, 'success');
      setTimeout(()=> this.winLevel(120+bonus), 700);
    }
  }

  // ========= HANOI =========
  renderHanoi() {
    this.hanoiState = { pegs:[[4,3,2,1],[],[]], fromPeg:null, moves:0, min:15 };
    const wrap = document.createElement('div');
    wrap.className='hanoi-wrap';
    wrap.innerHTML = `
      <div style="text-align:center">
        <div>Moves: <strong id="hanoiMoves" style="color:var(--ink)">0</strong> • Minimum: 15 • Rule: Larger disk cannot go on smaller</div>
        <div style="font-size:0.85rem;color:var(--muted);margin-top:4px">Click a peg to select, then click destination peg to move top disk</div>
      </div>
      <div class="hanoi-board" id="hanoiBoard"></div>
    `;
    this.elBoardContent.appendChild(wrap);
    this.drawHanoi();
  }

  drawHanoi() {
    const board = $('#hanoiBoard');
    if (!board) return;
    board.innerHTML='';
    this.hanoiState.pegs.forEach((peg, pi)=>{
      const div = document.createElement('div');
      div.className=`hanoi-peg ${this.hanoiState.fromPeg===pi?'selected':''}`;
      div.dataset.peg=pi;
      // disks
      peg.forEach(sz=>{
        const d = document.createElement('div');
        d.className='disk';
        const widthMap = {1:40,2:70,3:100,4:130};
        d.style.width = widthMap[sz]+'px';
        d.style.setProperty('--disk-w', widthMap[sz]+'px');
        d.style.background = ['#59dccb','#e0a756','#8fd46f','#b199ff'][sz-1];
        d.textContent = sz;
        div.appendChild(d);
      });
      div.addEventListener('click', ()=> this.handleHanoiClick(pi));
      board.appendChild(div);
    });
    $('#hanoiMoves').textContent = this.hanoiState.moves;
  }

  handleHanoiClick(pegIndex) {
    if (this.hanoiState.fromPeg===null) {
      if (this.hanoiState.pegs[pegIndex].length===0) {
        this.showFeedback('This peg is empty, select another.', 'error');
        return;
      }
      this.hanoiState.fromPeg = pegIndex;
      this.drawHanoi();
      this.showFeedback(`Selected peg ${pegIndex+1}. Now choose destination.`, 'info');
    } else {
      const from = this.hanoiState.fromPeg;
      const to = pegIndex;
      if (from===to) { this.hanoiState.fromPeg=null; this.drawHanoi(); this.hideFeedback(); return; }
      const fromPeg = this.hanoiState.pegs[from];
      const toPeg = this.hanoiState.pegs[to];
      const moving = fromPeg[fromPeg.length-1];
      const topDest = toPeg.length? toPeg[toPeg.length-1] : Infinity;
      if (moving < topDest) {
        fromPeg.pop();
        toPeg.push(moving);
        this.hanoiState.moves++;
        this.hanoiState.fromPeg=null;
        this.drawHanoi();
        this.hideFeedback();
        if (this.hanoiState.pegs[2].length===4) {
          const efficiency = this.hanoiState.moves <= 15 ? 100 : Math.max(0, 100 - (this.hanoiState.moves-15)*5);
          this.showFeedback(`Tower moved in ${this.hanoiState.moves} moves!`, 'success');
          setTimeout(()=> this.winLevel(200+efficiency), 700);
        }
      } else {
        this.showFeedback('Illegal move! Cannot place larger disk on smaller.', 'error');
        this.hanoiState.fromPeg=null;
        this.drawHanoi();
      }
    }
  }

  // ========= HINT / SKIP / RESET =========
  showHint() {
    const lvl = LEVELS[this.current];
    let msg = '';
    switch(lvl.id) {
      case 'logic':
        msg = `Expression: ${this.expressions[this.logicState.exprIndex].label}. Try setting ${Object.keys(this.logicState).filter(k=>['A','B','C'].includes(k)).map(k=>k+':'+(Math.random()>0.5)).join(', ')}`;
        break;
      case 'pattern':
        const pz = PATTERNS[this.patternState.puzzleIndex];
        msg = pz.hint;
        break;
      case 'debug':
        msg = DEBUGS[this.debugState.challengeIndex % DEBUGS.length].explain;
        break;
      case 'knap':
        msg = `Optimal profit is ${this.knapState.optimalProfit}. Look for best profit/cost ratio and avoid over capacity.`;
        break;
      case 'maze':
        msg = `Optimal path is ${this.mazeState.optimal} steps. Try BFS mentally: explore layer by layer from start.`;
        break;
      case 'hanoi':
        msg = 'Hanoi strategy: Move smallest disk every 2nd move, never place larger on smaller. 4 disks need 15 moves minimum.';
        break;
    }
    this.showFeedback(`💡 Hint: ${msg}`, 'info');
    this.hintsUsed++;
  }

  skipLevel() {
    if (this.current < LEVELS.length-1) {
      this.streak = 0;
      this.renderLevel(this.current+1);
    }
  }

  resetCurrent() {
    this.renderLevel(this.current);
  }

  winLevel(points) {
    const lvl = LEVELS[this.current];
    if (this.completed.has(lvl.id)) points = Math.floor(points*0.3); // reduced replay
    else {
      this.completed.add(lvl.id);
      this.totalSolved++;
    }
    this.score += points;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.updateStats();
    this.save();
    this.renderSidebar();
    this.showWinModal(lvl, points);
  }

  showWinModal(lvl, points) {
    if (!this.elModal) return;
    $('#modalTitle').textContent = 'Solved!';
    $('#modalDesc').textContent = `${lvl.title} completed. You earned ${points} points.`;
    $('#modalPoints').textContent = `+${points}`;
    $('#modalStreak').textContent = `${this.streak}x`;
    $('#modalTotal').textContent = `${this.score}`;
    this.elModal.classList.add('show');
  }

  hideModal() {
    if (this.elModal) this.elModal.classList.remove('show');
  }

  nextLevel() {
    this.hideModal();
    if (lvl = this.current < LEVELS.length-1) {
      // logic for pattern: change puzzle, debug: next challenge
      if (LEVELS[this.current].id==='pattern') {
        // stay? actually next level true progression
      }
      if (LEVELS[this.current].id==='debug') {
        this.debugState.challengeIndex++;
      }
      const nextIdx = this.current+1;
      if (nextIdx < LEVELS.length) this.renderLevel(nextIdx);
      else {
        this.showFeedback('🏆 All levels completed! You are a master problem solver. Replay any level.', 'success');
      }
    } else {
      this.hideModal();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const arena = new SolverArena();
  window.SolverArena = arena;
});
