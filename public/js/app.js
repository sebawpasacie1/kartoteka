let aktualnyPesel = null;

document.addEventListener('DOMContentLoaded', () => {
  ladujOsobySelect();
});

function pokazSekcje(nazwa) {
  const sekcje = ['osoby', 'denaci', 'sprawy', 'podejrzani', 'poszukiwani', 'nakazy', 'organizacje'];
  sekcje.forEach(s => {
    document.getElementById(`sekcja-${s}`).style.display = s === nazwa ? 'block' : 'none';
  });

  if (nazwa === 'denaci') ladujDenatow();
  if (nazwa === 'sprawy') ladujSprawy();
  if (nazwa === 'podejrzani') ladujPodejrzanych();
  if (nazwa === 'poszukiwani') ladujPoszukiwanych();
  if (nazwa === 'nakazy') ladujNakazy();
  if (nazwa === 'organizacje') ladujOrganizacje();
}

function otworzModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function zamknijModale() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
}

// OSOBY / KARTOTEKA
async function ladujOsobySelect() {
  const res = await fetch('/api/osoby');
  const osoby = await res.json();
  const select = document.getElementById('select-osoba');
  select.innerHTML = '<option value="">-- Wybierz osobę z listy --</option>';
  osoby.forEach(o => {
    select.innerHTML += `<option value="${o.pesel}">${o.imie} ${o.nazwisko} (PESEL: ${o.pesel}) - ${o.status}</option>`;
  });
}

async function ladujProfilOsoby(pesel) {
  if (!pesel) return;
  aktualnyPesel = pesel;
  const res = await fetch(`/api/osoby/${pesel}`);
  const data = await res.json();

  const o = data.osoba;
  const dowody = data.dowody;
  const raporty = data.raporty;

  const statusClass = `status-${o.status.replace(/ /g, '_')}`;

  let html = `
    <div style="background: #0f172a; padding: 20px; border-radius: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2>👤 ${o.imie} ${o.nazwisko}</h2>
        <span class="badge ${statusClass}">${o.status}</span>
      </div>
      <p><strong>PESEL:</strong> <code>${o.pesel}</code></p>
      <hr style="border-color: #334155; margin: 15px 0;">
      
      <p style="color: #38bdf8; font-weight: bold;">🔒 Tajne Akta Operacyjne / Zeznania:</p>
      <div style="background: #1e293b; padding: 10px; border-radius: 4px; font-family: monospace; margin-top: 5px; color: #cbd5e1;">
        ${o.notatka_tajna || 'Brak uwag śledczych.'}
      </div>

      <div style="margin-top: 15px;">
        <p style="color: #38bdf8; font-weight: bold;">🧪 Ekspertyzy Kryminalistyczne i Dowody:</p>
        ${dowody.length === 0 ? '<p style="color:#64748b; font-size: 12px;">Brak wpisanych dowodów.</p>' : ''}
        ${dowody.map(d => `<div style="font-size: 13px; margin-top: 5px;">• <code>${d.sygnatura}</code>: ${d.opis} <i>(Śledczy: ${d.sledczy})</i></div>`).join('')}
      </div>

      <div style="margin-top: 15px;">
        <p style="color: #38bdf8; font-weight: bold;">📜 Przesłuchania i Czynności:</p>
        ${raporty.length === 0 ? '<p style="color:#64748b; font-size: 12px;">Brak protokołów z przesłuchań.</p>' : ''}
        ${raporty.map(r => `
          <div style="background: #1e293b; padding: 10px; border-radius: 4px; margin-top: 5px; font-size: 12px;">
            <b>Wpis (${r.data}) - Śledczy: ${r.sledczy}</b><br>${r.tresc}
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="otworzModalStatus('${o.pesel}')">🔄 Zmień Status</button>
        <button class="btn btn-danger" onclick="otworzModalAreszt('${o.pesel}')">⚖️ Areszt / Kaucja</button>
        <button class="btn btn-primary" onclick="otworzModalDowod('${o.pesel}')">🔬 Dodaj Ekspertyzę</button>
        <button class="btn btn-success" onclick="otworzModalNotatka('${o.pesel}')">🕵️ Akta Operacyjne</button>
      </div>
    </div>
  `;

  document.getElementById('profil-osoby-details').innerHTML = html;
}

async function zapiszOsobe(e) {
  e.preventDefault();
  const imie = document.getElementById('reg-imie').value;
  const nazwisko = document.getElementById('reg-nazwisko').value;
  const pesel = document.getElementById('reg-pesel').value;

  const res = await fetch('/api/osoby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imie, nazwisko, pesel })
  });

  const data = await res.json();
  alert(data.message);
  if (data.success) {
    zamknijModale();
    ladujOsobySelect();
  }
}

function otworzModalStatus(pesel) { document.getElementById('status-pesel').value = pesel; otworzModal('modal-status'); }
async function zapiszStatus(e) {
  e.preventDefault();
  const pesel = document.getElementById('status-pesel').value;
  const status = document.getElementById('status-select').value;

  await fetch(`/api/osoby/${pesel}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  zamknijModale();
  ladujOsobySelect();
  ladujProfilOsoby(pesel);
}

function otworzModalAreszt(pesel) { document.getElementById('areszt-pesel').value = pesel; otworzModal('modal-areszt'); }
async function zapiszAreszt(e) {
  e.preventDefault();
  const pesel = document.getElementById('areszt-pesel').value;
  const zarzuty = document.getElementById('areszt-zarzuty').value;
  const srodek = document.getElementById('areszt-srodek').value;

  await fetch(`/api/osoby/${pesel}/areszt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zarzuty, srodek })
  });
  zamknijModale();
  ladujProfilOsoby(pesel);
}

function otworzModalDowod(pesel) { document.getElementById('dowod-pesel').value = pesel; otworzModal('modal-dowod'); }
async function zapiszDowod(e) {
  e.preventDefault();
  const pesel = document.getElementById('dowod-pesel').value;
  const sygnatura = document.getElementById('dowod-sygnatura').value;
  const analiza = document.getElementById('dowod-analiza').value;

  await fetch(`/api/osoby/${pesel}/dowod`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sygnatura, analiza })
  });
  zamknijModale();
  ladujProfilOsoby(pesel);
}

function otworzModalNotatka(pesel) { document.getElementById('notatka-pesel').value = pesel; otworzModal('modal-notatka'); }
async function zapiszNotatke(e) {
  e.preventDefault();
  const pesel = document.getElementById('notatka-pesel').value;
  const notatka = document.getElementById('notatka-tresc').value;

  await fetch(`/api/osoby/${pesel}/notatka`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notatka })
  });
  zamknijModale();
  ladujProfilOsoby(pesel);
}

// DENACI
async function ladujDenatow() {
  const res = await fetch('/api/denaci');
  const lista = await res.json();
  const div = document.getElementById('lista-denatow');
  div.innerHTML = lista.length === 0 ? 'Brak wpisów.' : lista.map(d => `
    <div class="card" style="border-left-color: #dc2626;">
      <div class="card-title">💀 ${d.dane} (PESEL: ${d.pesel})</div>
      <div class="card-body">
        <b>Data oględzin:</b> ${d.data}<br>
        <b>Prowadzący:</b> ${d.sledczy}<br>
        <b>Przyczyna / Ślady:</b> ${d.opis}
      </div>
    </div>
  `).join('');
}

async function zapiszDenata(e) {
  e.preventDefault();
  const imie_nazwisko = document.getElementById('denat-dane').value;
  const pesel = document.getElementById('denat-pesel').value;
  const przyczyna = document.getElementById('denat-przyczyna').value;

  await fetch('/api/denaci', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imie_nazwisko, pesel, przyczyna })
  });
  zamknijModale();
  ladujDenatow();
}

// SPRAWY
async function ladujSprawy() {
  const res = await fetch('/api/sprawy');
  const lista = await res.json();
  const div = document.getElementById('lista-spraw');
  div.innerHTML = lista.length === 0 ? 'Brak zarejestrowanych spraw.' : lista.map(s => `
    <div class="card">
      <div class="card-title">📌 ${s.sygnatura} [${s.status}]</div>
      <div class="card-body">
        <b>Wszczęcie:</b> ${s.data} | <b>Prowadzący:</b> ${s.prowadzacy}<br>
        <b>Podejrzani:</b> ${s.podejrzani}<br>
        <b>Ustalenia:</b> ${s.opis}
      </div>
    </div>
  `).join('');
}

async function zapiszSprawe(e) {
  e.preventDefault();
  const sygnatura = document.getElementById('sprawa-sygnatura').value;
  const podejrzani = document.getElementById('sprawa-podejrzani').value;
  const status = document.getElementById('sprawa-status').value;
  const hipotezy = document.getElementById('sprawa-hipotezy').value;

  await fetch('/api/sprawy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sygnatura, podejrzani, status, hipotezy })
  });
  zamknijModale();
  ladujSprawy();
}

// PODEJRZANI I POSZUKIWANI
async function ladujPodejrzanych() {
  const res = await fetch('/api/osoby/podejrzani');
  const lista = await res.json();
  const div = document.getElementById('lista-podejrzanych');
  div.innerHTML = lista.length === 0 ? 'Brak osób ze statusem Podejrzany / Oskarżony.' : lista.map(p => `
    <div class="card" style="border-left-color: #d97706;">
      <div class="card-title">👤 ${p.imie} ${p.nazwisko} (${p.status})</div>
      <div class="card-body">
        <b>PESEL:</b> ${p.pesel}<br>
        <b>Uwagi operacyjne:</b> ${p.notatka_tajna || 'Brak'}
      </div>
    </div>
  `).join('');
}

async function ladujPoszukiwanych() {
  const res = await fetch('/api/osoby/poszukiwani');
  const lista = await res.json();
  const div = document.getElementById('lista-poszukiwanych');
  div.innerHTML = lista.length === 0 ? 'Brak aktywnych listów gończych.' : lista.map(p => `
    <div class="card" style="border-left-color: #dc2626;">
      <div class="card-title">🚨 POSZUKIWANY: ${p.imie} ${p.nazwisko}</div>
      <div class="card-body">
        <b>PESEL:</b> ${p.pesel}<br>
        <b>Powód wydania listu:</b> ${p.notatka_tajna || 'Brak'}
      </div>
    </div>
  `).join('');
}

// NAKAZY
async function ladujNakazy() {
  const res = await fetch('/api/nakazy');
  const lista = await res.json();
  const div = document.getElementById('lista-nakazow');
  div.innerHTML = lista.length === 0 ? 'Brak zarejestrowanych nakazów.' : lista.map(n => `
    <div class="card" style="border-left-color: #16a34a;">
      <div class="card-title">⚖️ Dotyczy: ${n.cel}</div>
      <div class="card-body">
        <b>Organ:</b> ${n.prokurator}<br>
        <b>Wprowadził:</b> ${n.sledczy} (${n.data})<br>
        <a href="${n.link}" target="_blank" style="color: #38bdf8;">🔗 Zobacz dokumentację</a>
      </div>
    </div>
  `).join('');
}

async function zapiszNakaz(e) {
  e.preventDefault();
  const prokurator = document.getElementById('nakaz-prokurator').value;
  const cel = document.getElementById('nakaz-cel').value;
  const link = document.getElementById('nakaz-link').value;

  await fetch('/api/nakazy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prokurator, cel, link })
  });
  zamknijModale();
  ladujNakazy();
}

// ORGANIZACJE
async function ladujOrganizacje() {
  const res = await fetch('/api/organizacje');
  const lista = await res.json();
  const div = document.getElementById('lista-organizacji');
  div.innerHTML = lista.length === 0 ? 'Brak rozpracowywanych grup.' : lista.map(o => `
    <div class="card" style="border-left-color: #9333ea;">
      <div class="card-title">🏴 ${o.nazwa} [${o.typ}]</div>
      <div class="card-body">
        <b>Struktura/Hierarchia:</b><br>${o.struktura}<br><br>
        <b>Ustalenia operacyjne:</b><br>${o.opis}
      </div>
    </div>
  `).join('');
}

async function zapiszOrganizacje(e) {
  e.preventDefault();
  const nazwa = document.getElementById('org-nazwa').value;
  const typ = document.getElementById('org-typ').value;
  const struktura = document.getElementById('org-struktura').value;
  const opis = document.getElementById('org-opis').value;

  await fetch('/api/organizacje', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nazwa, typ, struktura, opis })
  });
  zamknijModale();
  ladujOrganizacje();
}
