/**
 * Seed 1000 coding challenges (20 types × 50 variants each).
 * Run: node seed-questions.js
 */
const mysql = require('mysql2/promise');
const { v4: uuid } = require('uuid');

const DB = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'codearena' };

// ── Helpers ───────────────────────────────────────────────────────────
const r   = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rA  = (len, a, b) => Array.from({ length: len }, () => r(a, b));
const V   = new Set('aeiou');
const fib = (() => { const c = [0,1]; for(let k=2;k<=50;k++) c.push(c[k-1]+c[k-2]); return c; })();
const isPrime = n => { if(n<2) return false; for(let i=2;i*i<=n;i++) if(n%i===0) return false; return true; };

// ── DB helpers ────────────────────────────────────────────────────────
let insertCount = 0;

async function insertChallenge(conn, adminId, { title, desc, difficulty, category, tcs }) {
  const cid  = uuid();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + cid.slice(0,6);
  await conn.execute(
    `INSERT INTO challenges
       (id, title, slug, description, difficulty, category, supported_languages,
        time_limit_ms, memory_limit_mb, max_submissions, submission_cooldown_seconds,
        is_published, randomize_inputs, created_by)
     VALUES (?,?,?,?,?,?,?,5000,256,10,30,1,0,?)`,
    [cid, title, slug, desc, difficulty, category,
     JSON.stringify(['javascript','python']), adminId],
  );
  for (let i = 0; i < tcs.length; i++) {
    await conn.execute(
      `INSERT INTO test_cases
         (id, challenge_id, input, expected_output, is_sample, is_hidden, points, order_index)
       VALUES (?,?,?,?,?,?,1,?)`,
      [uuid(), cid, tcs[i].input, tcs[i].expected, i < 1 ? 1 : 0, i < 1 ? 0 : 1, i],
    );
  }
  insertCount++;
  if (insertCount % 100 === 0) process.stdout.write(`  ${insertCount} challenges inserted...\n`);
}

function hiddenArr(fn, count = 4) {
  return Array.from({ length: count }, fn);
}

// ── Type generators ───────────────────────────────────────────────────
function typeArraySum(i) {
  const arr = rA(r(3,8), 1, 99);
  const sum = arr.reduce((a,b)=>a+b,0);
  const desc = `Given ${arr.length} integers, compute and print their sum.\n\n**Input**\n- Line 1: N (count of integers)\n- Line 2: N space-separated integers\n\n**Output:** The sum.\n\n**Example**\nInput:\n\`\`\`\n${arr.length}\n${arr.join(' ')}\n\`\`\`\nOutput: \`${sum}\``;
  const tcs = [{ input: `${arr.length}\n${arr.join(' ')}`, expected: `${sum}` },
    ...hiddenArr(() => { const a=rA(r(3,8),1,99); return { input:`${a.length}\n${a.join(' ')}`, expected:`${a.reduce((x,y)=>x+y,0)}` }; })];
  return { title:`Array Sum #${i+1}`, desc, difficulty:'easy', category:'Arrays', tcs };
}

function typeArrayMax(i) {
  const arr = rA(r(3,8), 1, 999);
  const mx  = Math.max(...arr);
  const desc = `Find the largest number in the list.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** The maximum value.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${mx}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${mx}` },
    ...hiddenArr(()=>{ const a=rA(r(3,8),1,999); return { input:`${a.length}\n${a.join(' ')}`, expected:`${Math.max(...a)}` }; })];
  return { title:`Find the Maximum #${i+1}`, desc, difficulty:'easy', category:'Arrays', tcs };
}

function typeArrayMin(i) {
  const arr = rA(r(3,8), 1, 999);
  const mn  = Math.min(...arr);
  const desc = `Find the smallest number in the list.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** The minimum value.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${mn}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${mn}` },
    ...hiddenArr(()=>{ const a=rA(r(3,8),1,999); return { input:`${a.length}\n${a.join(' ')}`, expected:`${Math.min(...a)}` }; })];
  return { title:`Find the Minimum #${i+1}`, desc, difficulty:'easy', category:'Arrays', tcs };
}

const REV_WORDS = ['algorithm','database','function','variable','network','keyboard','monitor','software','hardware','internet',
                   'program','compile','execute','runtime','memory','pointer','structure','recursion','iteration','operator',
                   'challenge','solution','exception','parameter','condition','interface','extension','framework','component','resource'];
function typeStringReverse(i) {
  const w   = REV_WORDS[i % REV_WORDS.length] + (i >= REV_WORDS.length ? r(10,99) : '');
  const rev = w.split('').reverse().join('');
  const desc = `Reverse the given string.\n\n**Input:** A single string (no spaces)\n**Output:** The reversed string\n\n**Example** Input: \`${w}\` → Output: \`${rev}\``;
  const tcs = [{ input:w, expected:rev },
    ...hiddenArr(()=>{ const x=REV_WORDS[r(0,REV_WORDS.length-1)]+r(10,99); return { input:x, expected:x.split('').reverse().join('') }; })];
  return { title:`Reverse a String #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

const VOW_WORDS = ['programming','beautiful','education','information','computer','keyboard','elephant','adventure','universe',
                   'challenge','learning','practice','develop','execute','compile','algorithm','solution','efficient','operation','collection'];
function typeCountVowels(i) {
  const w  = VOW_WORDS[i%VOW_WORDS.length] + (i>=VOW_WORDS.length ? VOW_WORDS[(i+3)%VOW_WORDS.length] : '');
  const vc = [...w].filter(c=>V.has(c)).length;
  const desc = `Count the number of vowels (a, e, i, o, u) in the given string.\n\n**Input:** A lowercase string\n**Output:** Number of vowels\n\n**Example** Input: \`${w}\` → Output: \`${vc}\``;
  const tcs = [{ input:w, expected:`${vc}` },
    ...hiddenArr(()=>{ const x=VOW_WORDS[r(0,VOW_WORDS.length-1)]; return { input:x, expected:`${[...x].filter(c=>V.has(c)).length}` }; })];
  return { title:`Count the Vowels #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

function typeFactorial(i) {
  const n = r(1,12);
  let f=1; for(let k=2;k<=n;k++) f*=k;
  const desc = `Calculate the factorial of N (N! = 1 × 2 × ... × N).\n\n**Input:** A single integer N (1 ≤ N ≤ 12)\n**Output:** N!\n\n**Example** Input: \`${n}\` → Output: \`${f}\``;
  const tcs = [{ input:`${n}`, expected:`${f}` },
    ...hiddenArr(()=>{ const n2=r(1,12); let f2=1; for(let k=2;k<=n2;k++) f2*=k; return { input:`${n2}`, expected:`${f2}` }; })];
  return { title:`Factorial Calculator #${i+1}`, desc, difficulty:'easy', category:'Math', tcs };
}

function typeFibonacci(i) {
  const n = r(5,40);
  const desc = `Find the Nth Fibonacci number (0-indexed: F(0)=0, F(1)=1).\n\n**Input:** Integer N\n**Output:** F(N)\n\n**Example** Input: \`${n}\` → Output: \`${fib[n]}\``;
  const tcs = [{ input:`${n}`, expected:`${fib[n]}` },
    ...hiddenArr(()=>{ const n2=r(5,40); return { input:`${n2}`, expected:`${fib[n2]}` }; })];
  return { title:`Fibonacci Number #${i+1}`, desc, difficulty:'easy', category:'Math', tcs };
}

function typeDigitSum(i) {
  const n  = r(1000, 999999);
  const ds = String(n).split('').reduce((a,c)=>a+parseInt(c),0);
  const desc = `Find the sum of all digits in the given number.\n\nExample: 1234 → 1+2+3+4 = 10\n\n**Input:** A positive integer\n**Output:** Digit sum\n\n**Example** Input: \`${n}\` → Output: \`${ds}\``;
  const tcs = [{ input:`${n}`, expected:`${ds}` },
    ...hiddenArr(()=>{ const n2=r(1000,999999); return { input:`${n2}`, expected:`${String(n2).split('').reduce((a,c)=>a+parseInt(c),0)}` }; })];
  return { title:`Sum of Digits #${i+1}`, desc, difficulty:'easy', category:'Math', tcs };
}

function typeCountEven(i) {
  const arr    = rA(r(4,10), 1, 99);
  const evens  = arr.filter(x=>x%2===0).length;
  const desc = `Count how many even numbers are in the list.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** Count of even numbers.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${evens}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${evens}` },
    ...hiddenArr(()=>{ const a=rA(r(4,10),1,99); return { input:`${a.length}\n${a.join(' ')}`, expected:`${a.filter(x=>x%2===0).length}` }; })];
  return { title:`Count Even Numbers #${i+1}`, desc, difficulty:'easy', category:'Arrays', tcs };
}

function typeSortAscending(i) {
  const arr    = rA(r(4,8), 1, 99);
  const sorted = [...arr].sort((a,b)=>a-b);
  const desc = `Sort the array in ascending order.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** Sorted numbers, space-separated.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${sorted.join(' ')}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:sorted.join(' ') },
    ...hiddenArr(()=>{ const a=rA(r(4,8),1,99); return { input:`${a.length}\n${a.join(' ')}`, expected:[...a].sort((x,y)=>x-y).join(' ') }; })];
  return { title:`Sort Ascending #${i+1}`, desc, difficulty:'medium', category:'Arrays', tcs };
}

function typeAverage(i) {
  const arr = rA(r(3,8), 1, 100);
  const avg = Math.floor(arr.reduce((a,b)=>a+b,0)/arr.length);
  const desc = `Compute the integer (floor) average of the numbers.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** Floor of average.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${avg}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${avg}` },
    ...hiddenArr(()=>{ const a=rA(r(3,8),1,100); return { input:`${a.length}\n${a.join(' ')}`, expected:`${Math.floor(a.reduce((x,y)=>x+y,0)/a.length)}` }; })];
  return { title:`Array Average #${i+1}`, desc, difficulty:'easy', category:'Math', tcs };
}

function typeCountOdd(i) {
  const arr  = rA(r(4,10), 1, 99);
  const odds = arr.filter(x=>x%2!==0).length;
  const desc = `Count how many odd numbers are in the list.\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** Count of odd numbers.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${odds}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${odds}` },
    ...hiddenArr(()=>{ const a=rA(r(4,10),1,99); return { input:`${a.length}\n${a.join(' ')}`, expected:`${a.filter(x=>x%2!==0).length}` }; })];
  return { title:`Count Odd Numbers #${i+1}`, desc, difficulty:'easy', category:'Arrays', tcs };
}

function typeProduct(i) {
  const arr  = rA(r(2,6), 1, 9);
  const prod = arr.reduce((a,b)=>a*b,1);
  const desc = `Find the product of all numbers in the array.\n\n**Input**\n- Line 1: N\n- Line 2: N integers (1 ≤ each ≤ 9)\n\n**Output:** The product.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${prod}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${prod}` },
    ...hiddenArr(()=>{ const a=rA(r(2,6),1,9); return { input:`${a.length}\n${a.join(' ')}`, expected:`${a.reduce((x,y)=>x*y,1)}` }; })];
  return { title:`Product of Array #${i+1}`, desc, difficulty:'easy', category:'Math', tcs };
}

const LEN_WORDS=['programming','challenge','algorithm','database','interface','functionality','optimization','computation','abstraction','polymorphism',
                 'inheritance','encapsulation','synchronization','implementation','documentation','authentication','authorization','configuration','initialization','serialization'];
function typeStringLength(i) {
  const w = LEN_WORDS[i%LEN_WORDS.length];
  const desc = `Output the length of the given string.\n\n**Input:** A single string\n**Output:** Its character count.\n\n**Example** Input: \`${w}\` → Output: \`${w.length}\``;
  const tcs = [{ input:w, expected:`${w.length}` },
    ...hiddenArr(()=>{ const x=LEN_WORDS[r(0,LEN_WORDS.length-1)]; return { input:x, expected:`${x.length}` }; })];
  return { title:`String Length #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

const PALIN=['racecar','level','madam','civic','radar','noon','deed','repaper','reviver','rotator'];
const NOTPAL=['hello','world','python','coding','challenge','learning','practice','develop','execute','compile'];
function typePalindrome(i) {
  const w  = i%2===0 ? PALIN[Math.floor(i/2)%10] : NOTPAL[Math.floor(i/2)%10];
  const is = w===w.split('').reverse().join('');
  const desc = `Check if the string is a palindrome (reads same forwards and backwards).\n\n**Input:** A lowercase string\n**Output:** YES or NO\n\n**Example** Input: \`${w}\` → Output: \`${is?'YES':'NO'}\``;
  const all = [...PALIN,...NOTPAL];
  const tcs = [{ input:w, expected:is?'YES':'NO' },
    ...hiddenArr(()=>{ const x=all[r(0,19)]; const p=x===x.split('').reverse().join(''); return { input:x, expected:p?'YES':'NO' }; })];
  return { title:`Palindrome Check #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

const CONS_WORDS=['programming','challenge','beautiful','knowledge','adventure','computation','development','education','environment','imagination',
                  'keyboard','mouse','screen','power','cable','server','router','switch','bridge','packet'];
function typeConsonants(i) {
  const w  = CONS_WORDS[i%CONS_WORDS.length];
  const ct = [...w].filter(c=>c>='a'&&c<='z'&&!V.has(c)).length;
  const desc = `Count the consonants in the string (letters that are NOT vowels a,e,i,o,u).\n\n**Input:** A lowercase string\n**Output:** Consonant count.\n\n**Example** Input: \`${w}\` → Output: \`${ct}\``;
  const tcs = [{ input:w, expected:`${ct}` },
    ...hiddenArr(()=>{ const x=CONS_WORDS[r(0,CONS_WORDS.length-1)]; return { input:x, expected:`${[...x].filter(c=>c>='a'&&c<='z'&&!V.has(c)).length}` }; })];
  return { title:`Count Consonants #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

function typeSecondLargest(i) {
  let arr; do { arr = rA(r(4,8),1,99); } while(new Set(arr).size < 2);
  const sl = [...new Set(arr)].sort((a,b)=>b-a)[1];
  const desc = `Find the second largest distinct value in the array.\n\n**Input**\n- Line 1: N\n- Line 2: N integers (at least 2 distinct values)\n\n**Output:** Second largest value.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${sl}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${sl}` },
    ...hiddenArr(()=>{ let a; do{a=rA(r(4,8),1,99);}while(new Set(a).size<2); const s=[...new Set(a)].sort((x,y)=>y-x)[1]; return { input:`${a.length}\n${a.join(' ')}`, expected:`${s}` }; })];
  return { title:`Second Largest #${i+1}`, desc, difficulty:'medium', category:'Arrays', tcs };
}

const UC_WORDS=['Hello World','JavaScript Code','Python Program','Array Sort','Quick Brown Fox',
                'Data Structure','Binary Search','Linked List','Hash Table','Stack Queue',
                'Binary Tree','Depth First','Breadth First','Dynamic Program','Greedy Algorithm',
                'Graph Theory','Merge Sort','Quick Sort','Bubble Sort','Heap Sort'];
function typeUppercase(i) {
  const w  = UC_WORDS[i%UC_WORDS.length];
  const uc = [...w].filter(c=>c>='A'&&c<='Z').length;
  const desc = `Count the uppercase letters in the string.\n\n**Input:** A string (may have uppercase, lowercase, spaces)\n**Output:** Count of uppercase letters.\n\n**Example** Input: \`${w}\` → Output: \`${uc}\``;
  const tcs = [{ input:w, expected:`${uc}` },
    ...hiddenArr(()=>{ const x=UC_WORDS[r(0,UC_WORDS.length-1)]; return { input:x, expected:`${[...x].filter(c=>c>='A'&&c<='Z').length}` }; })];
  return { title:`Count Uppercase #${i+1}`, desc, difficulty:'easy', category:'Strings', tcs };
}

function typeSumSquares(i) {
  const arr   = rA(r(3,7), 1, 20);
  const sumSq = arr.reduce((a,b)=>a+b*b,0);
  const desc = `Find the sum of squares: a² + b² + ...\n\n**Input**\n- Line 1: N\n- Line 2: N integers\n\n**Output:** Sum of squares.\n\n**Example** Input: \`${arr.length}\\n${arr.join(' ')}\` → Output: \`${sumSq}\``;
  const tcs = [{ input:`${arr.length}\n${arr.join(' ')}`, expected:`${sumSq}` },
    ...hiddenArr(()=>{ const a=rA(r(3,7),1,20); return { input:`${a.length}\n${a.join(' ')}`, expected:`${a.reduce((x,y)=>x+y*y,0)}` }; })];
  return { title:`Sum of Squares #${i+1}`, desc, difficulty:'medium', category:'Math', tcs };
}

function typeFizzBuzz(i) {
  const n   = r(1,200);
  const res = n%15===0?'FizzBuzz':n%3===0?'Fizz':n%5===0?'Buzz':`${n}`;
  const desc = `Apply the FizzBuzz rule:\n- Divisible by 3 and 5 → FizzBuzz\n- Divisible by 3 only → Fizz\n- Divisible by 5 only → Buzz\n- Otherwise → the number itself\n\n**Input:** Integer N\n**Output:** Fizz / Buzz / FizzBuzz / N\n\n**Example** Input: \`${n}\` → Output: \`${res}\``;
  const tcs = [{ input:`${n}`, expected:res },
    ...hiddenArr(()=>{ const n2=r(1,200); const r2=n2%15===0?'FizzBuzz':n2%3===0?'Fizz':n2%5===0?'Buzz':`${n2}`; return { input:`${n2}`, expected:r2 }; })];
  return { title:`FizzBuzz Check #${i+1}`, desc, difficulty:'easy', category:'Logic', tcs };
}

// ── Main ──────────────────────────────────────────────────────────────
const TYPES = [
  typeArraySum, typeArrayMax, typeArrayMin, typeStringReverse, typeCountVowels,
  typeFactorial, typeFibonacci, typeDigitSum, typeCountEven, typeSortAscending,
  typeAverage, typeCountOdd, typeProduct, typeStringLength, typePalindrome,
  typeConsonants, typeSecondLargest, typeUppercase, typeSumSquares, typeFizzBuzz,
];

async function main() {
  const conn = await mysql.createConnection(DB);
  console.log('Connected. Fetching admin ID...');

  const [rows] = await conn.execute(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
  if (!rows.length) { console.error('No admin user found. Create one first.'); process.exit(1); }
  const adminId = rows[0].id;
  console.log(`Admin ID: ${adminId}`);

  // Check existing count
  const [[{ cnt }]] = await conn.execute(`SELECT COUNT(*) AS cnt FROM challenges`);
  console.log(`Existing challenges: ${cnt}`);
  if (cnt >= 1000) { console.log('Already have 1000+ challenges. Skipping seed.'); await conn.end(); return; }

  console.log('Generating 1000 challenges (20 types × 50 each)...');

  for (let type = 0; type < TYPES.length; type++) {
    for (let variant = 0; variant < 50; variant++) {
      const q = TYPES[type](variant);
      await insertChallenge(conn, adminId, q);
    }
  }

  console.log(`\nDone! Total inserted: ${insertCount} challenges.`);
  await conn.end();
}

main().catch(err => { console.error(err.message); process.exit(1); });
