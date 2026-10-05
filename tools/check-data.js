/* Structural validation of the test data. Run: node tools/check-data.js */
'use strict';
global.window = global;
const path = require('path');
const base = path.resolve(__dirname, '..');
require(base + '/data/registry.js');
['test1', 'test2', 'test3'].forEach(t => {
  ['listening', 'reading', 'productive'].forEach(f => require(`${base}/data/${t}/${f}.js`));
});

let fail = 0;
const bad = m => { fail++; console.log('  x ' + m); };
const PH = /\[\[(\d+)\]\]/g;
const walk = (sec, cb) => (sec.parts || sec.sections || [])
  .forEach(p => (p.groups || []).forEach(g => cb(g, p)));

IELTSData.list().forEach(t => {
  console.log('=== ' + t.id + ' — ' + t.name);
  ['listening', 'readingAcademic', 'readingGeneral'].forEach(k => {
    const sec = t[k];
    if (!sec) return bad(k + ' missing');
    let ns = [];
    walk(sec, g => {
      const tag = `${k} [${g.kind} ${g.title || ''}]`;
      (g.questions || []).forEach(q => {
        (q.ns || [q.n]).forEach(n => ns.push(n));
        if (q.answer === undefined) bad(`${tag} Q${q.n || q.ns} has no answer`);
        if (!q.evidence) bad(`${tag} Q${q.n || q.ns} has no evidence note`);
      });
      if (g.blocks) {
        const found = [...JSON.stringify(g.blocks).matchAll(PH)].map(m => +m[1]);
        const qn = (g.questions || []).map(q => q.n);
        found.forEach(n => { if (!qn.includes(n)) bad(`${tag} placeholder ${n} has no question`); });
        const dup = found.filter((v, i) => found.indexOf(v) !== i);
        if (dup.length) bad(`${tag} duplicate placeholders ${dup}`);
        if (['gap', 'gap-bank'].includes(g.kind)) {
          qn.forEach(n => { if (!found.includes(n)) bad(`${tag} Q${n} has no placeholder`); });
        }
      } else if (['gap', 'gap-bank'].includes(g.kind)) bad(tag + ' has no blocks');

      if (['matching', 'headings', 'label-select', 'gap-bank'].includes(g.kind)) {
        const keys = (g.options || []).map(o => o.k);
        (g.questions || []).forEach(q => {
          if (!keys.includes(q.answer)) bad(`${tag} Q${q.n} answer "${q.answer}" not in options`);
        });
        const used = (g.questions || []).map(q => q.answer);
        const dup = used.filter((v, i) => used.indexOf(v) !== i);
        if (dup.length) bad(`${tag} repeats answer letter(s) ${dup}`);
        if (keys.length < (g.questions || []).length) bad(tag + ' fewer options than questions');
      }
      if (g.kind === 'mcq') (g.questions || []).forEach(q => {
        const keys = (q.options || g.options || []).map(o => o.k);
        if (!keys.includes(q.answer)) bad(`${tag} Q${q.n} answer ${q.answer} not in options`);
      });
      if (g.kind === 'mcq-multi') (g.questions || []).forEach(q => {
        const keys = (g.options || []).map(o => o.k);
        if (!Array.isArray(q.answer) || q.answer.length !== q.ns.length) bad(tag + ' answer/ns mismatch');
        (q.answer || []).forEach(a => { if (!keys.includes(a)) bad(`${tag} answer ${a} not in options`); });
      });
      if (g.kind === 'tfng') (g.questions || []).forEach(q => {
        if (!['TRUE', 'FALSE', 'NOT GIVEN'].includes(q.answer)) bad(`${tag} Q${q.n} bad TFNG value`);
      });
      if (g.kind === 'ynng') (g.questions || []).forEach(q => {
        if (!['YES', 'NO', 'NOT GIVEN'].includes(q.answer)) bad(`${tag} Q${q.n} bad YNNG value`);
      });
      if (['gap', 'short'].includes(g.kind)) (g.questions || []).forEach(q => {
        const lim = q.maxWords || g.maxWords;
        [q.answer].concat(q.accept || []).forEach(a => {
          if (!lim || typeof a !== 'string') return;
          const wc = a.trim().split(/\s+/).length;
          if (wc > lim) bad(`${tag} Q${q.n} accepted answer "${a}" is ${wc} words, limit ${lim}`);
        });
      });
    });
    const sorted = ns.slice().sort((a, b) => a - b);
    const dups = sorted.filter((v, i) => i && sorted[i - 1] === v);
    const miss = []; for (let i = 1; i <= 40; i++) if (!sorted.includes(i)) miss.push(i);
    if (dups.length) bad(`${k} duplicate question numbers ${dups}`);
    if (miss.length) bad(`${k} missing question numbers ${miss}`);
    if (JSON.stringify(ns) !== JSON.stringify(sorted)) bad(k + ' questions are out of order');
    console.log(`  ${k.padEnd(16)} ${ns.length} questions`);
  });
  ['writingAcademic', 'writingGeneral'].forEach(k => {
    const wtask = t[k];
    if (!wtask || wtask.tasks.length !== 2) return bad(k + ' does not have 2 tasks');
    wtask.tasks.forEach((tk, i) => {
      if (!tk.model || !tk.model.length) bad(`${k} task${i + 1} has no model answer`);
      const n = tk.model.join(' ').split(/\s+/).length;
      if (n < tk.minWords) bad(`${k} task${i + 1} model is ${n} words, below ${tk.minWords}`);
      if (!tk.checklist || !tk.tips) bad(`${k} task${i + 1} missing tips/checklist`);
    });
  });
  const s = t.speaking;
  if (!s || !s.part1 || !s.part2 || !s.part3 || !s.samples) bad('speaking incomplete');
});
console.log(fail ? `\n${fail} PROBLEM(S)` : '\nAll structural checks passed.');
process.exit(fail ? 1 : 0);
