/*
 * Common JavaScript for the home/index page.  This module contains
 * CSV parsing utilities, table rendering functions and sortable
 * column helpers.  Keeping this logic in a separate file allows the
 * HTML to remain clean and both pages to share parsing code if needed.
 */

/* Parse a CSV string into an array of rows (each row is an array of
   strings). Quoted values and escaped quotes are handled. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Convert an array of CSV rows into an array of objects keyed by
   uppercase header names. Empty rows are skipped. */
function csvToObjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const norm = header.map(h => h.replace(/\s+/g, '_').toUpperCase());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(x => !x || !x.trim())) continue;
    const obj = {};
    for (let j = 0; j < norm.length; j++) obj[norm[j]] = (r[j] ?? '').trim();
    out.push(obj);
  }
  return out;
}

/* Fetch a CSV file and render it into a table body.  The `mapObjToCells`
   callback should return an array of cell contents for each row.  If
   the callback returns objects with an `__html__` property, that
   content is inserted as HTML. */
async function renderFromCSV(tableId, csvUrl, mapObjToCells) {
  const text = await fetch(csvUrl).then(r => r.text());
  const data = csvToObjects(text);
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  data.forEach(obj => {
    const tr = document.createElement('tr');
    mapObjToCells(obj).forEach(cell => {
      const td = document.createElement('td');
      if (cell && cell.__html__) td.innerHTML = cell.__html__;
      else td.textContent = cell ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/* Sorting helpers.  Sorts CVE identifiers by year and number. */
function compareCVE(aText, bText, asc) {
  const parse = (s) => {
    const m = s.trim().match(/^CVE-(\d{4})-(\d{1,})$/i);
    return m ? { year: parseInt(m[1], 10), num: parseInt(m[2], 10) } : null;
  };
  const A = parse(aText), B = parse(bText);
  if (A && B) {
    if (A.year !== B.year) return asc ? (A.year - B.year) : (B.year - A.year);
    if (A.num !== B.num) return asc ? (A.num - B.num) : (B.num - A.num);
    return 0;
  }
  return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
}

/* Sort a table by column index `col` and type.  Numeric types sort by
   numeric value, 'cve' uses the compareCVE helper, all others use
   string locale comparison.  A truthy `th` toggles sort direction. */
function sortTable(table, col, type, th) {
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  // Toggle direction: default ascending until toggled
  const asc = !table.asc;
  rows.sort((a, b) => {
    const A = a.cells[col].innerText.trim();
    const B = b.cells[col].innerText.trim();
    if (type === 'number') {
      const nA = parseFloat(A), nB = parseFloat(B);
      const NA = isNaN(nA), NB = isNaN(nB);
      if (NA && NB) return 0;
      if (NA) return asc ? 1 : -1;
      if (NB) return asc ? -1 : 1;
      return asc ? (nA - nB) : (nB - nA);
    }
    if (type === 'cve') {
      return compareCVE(A, B, asc);
    }
    return asc ? A.localeCompare(B) : B.localeCompare(A);
  });
  rows.forEach(r => tbody.appendChild(r));
  table.asc = asc;
  if (th) setSortIndicator(th, asc ? 'asc' : 'desc');
}

/* Update sort indicator on table header cells */
function setSortIndicator(th, dir) {
  th.parentElement.querySelectorAll('th.sortable').forEach(h => h.removeAttribute('data-sort'));
  if (dir) th.setAttribute('data-sort', dir);
}

/* Update the displayed CVE count next to the header on the index page */
function updateCveCount() {
  const n = document.getElementById('cve-table').tBodies[0].rows.length;
  const meta = document.getElementById('cve-count');
  if (meta) meta.textContent = 'Total CVEs: ' + n;
}

/* When the DOM is ready, populate the CVE and CTF tables and attach
   sorting handlers. */
document.addEventListener('DOMContentLoaded', async () => {
  // If the CVE table exists on the page, populate it
  const cveTable = document.getElementById('cve-table');
  if (cveTable) {
    await renderFromCSV('cve-table', 'cves.csv', obj => {
      const id = obj.ID || '';
      const soft = obj.SOFTWARE || '';
      const cwe = obj.CWE || '';
      const score = obj.SCORE || '';
      const severity = obj.SEVERITY || '';
      const cveUrl = obj.CVE_URL || obj.CVE || '';
      const writeUrl = obj.WRITEUP_URL || obj.WRITEUPURL || obj.WRITEUP || '';
      const explUrl = obj.EXPLOIT_URL || obj.EXPLOITURL || obj.EXPLOIT || obj.EXPLOITDB || '';
      const refs = [];
      if (cveUrl) refs.push(`<a class="reference" href="${cveUrl}" target="_blank" rel="noopener">CVE Record</a>`);
      if (writeUrl) refs.push(`<span> | </span><a class="reference" href="${writeUrl}" target="_blank" rel="noopener">Write‑up</a>`);
      if (explUrl) refs.push(`<span> | </span><a class="reference" href="${explUrl}" target="_blank" rel="noopener">Exploit</a>`);
      return [id, soft, cwe, score, severity, { __html__: refs.join(' ') }];
    });
    updateCveCount();
    // initial sort ascending by CVE ID
    cveTable.asc = true;
    sortTable(cveTable, 0, 'cve', cveTable.tHead.rows[0].cells[0]);
    // attach click handlers for sorting
    cveTable.querySelectorAll('th.sortable').forEach((th, i) => {
      th.addEventListener('click', () => sortTable(cveTable, i, th.getAttribute('data-type'), th));
    });
  }
  // Populate the CTF table if present
  const ctfTable = document.getElementById('ctf-table');
  if (ctfTable) {
    await renderFromCSV('ctf-table', 'ctfs.csv', obj => {
      const name = obj.NAME || '';
      const company = obj.COMPANY || '';
      const ref1 = obj.REF1 || obj.OFFSEC || '';
      const ref2label = obj.REF2LABEL || obj.LABEL || '';
      const ref2url = obj.REF2URL || '';
      const refs = [];
      if (ref1) refs.push(`<a class="reference" href="${ref1}" target="_blank" rel="noopener">Offsec Portal</a>`);
      if (ref2label && ref2url) refs.push(`<span> | </span><a class="reference" href="${ref2url}" target="_blank" rel="noopener">${ref2label}</a>`);
      return [name, company, { __html__: refs.join(' ') }];
    });
    // attach click handlers for CTF table sorting
    ctfTable.querySelectorAll('th.sortable').forEach((th, i) => {
      th.addEventListener('click', () => sortTable(ctfTable, i, th.getAttribute('data-type'), th));
    });
  }
});