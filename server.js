const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/WDS_Database';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Polaczenie z baza danych MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Polaczono z baza MongoDB (WDS_Database)'))
  .catch(err => console.error('❌ Blad polaczenia z MongoDB:', err));

// SCHEMATY I MODELE
const KartotekaSchema = new mongoose.Schema({
  imie: String,
  nazwisko: String,
  pesel: { type: String, unique: true, required: true },
  status: { type: String, default: 'CZYSTY' },
  notatka_tajna: { type: String, default: 'Brak uwag operacyjnych.' }
}, { collection: 'wds_kartoteka_osob' });

const DowodSchema = new mongoose.Schema({
  sygnatura: String,
  pesel: String,
  opis: String,
  sledczy: String,
  data: String
}, { collection: 'wds_dowody_kryminalistyczne' });

const RaportSchema = new mongoose.Schema({
  pesel_podejrzanego: String,
  sledczy: String,
  data: String,
  tresc: String
}, { collection: 'wds_przesluchania_i_notatki' });

const DenatSchema = new mongoose.Schema({
  dane: String,
  pesel: String,
  opis: String,
  sledczy: String,
  data: String
}, { collection: 'wds_rejestr_sekcji_zwlok' });

const SprawaSchema = new mongoose.Schema({
  sygnatura: { type: String, unique: true },
  podejrzani: String,
  opis: String,
  status: { type: String, default: 'W TOKU' },
  prowadzacy: String,
  data: String
}, { collection: 'wds_akt_swiadka_i_sledztw' });

const NakazSchema = new mongoose.Schema({
  prokurator: String,
  cel: String,
  link: String,
  data: String,
  sledczy: String
}, { collection: 'wds_nakazy_i_postanowienia' });

const OrganizacjaSchema = new mongoose.Schema({
  nazwa: { type: String, unique: true },
  typ: String,
  struktura: String,
  opis: String,
  wprowadzil: String,
  data: String
}, { collection: 'wds_grupy_przestępcze' });

const Kartoteka = mongoose.model('Kartoteka', KartotekaSchema);
const Dowod = mongoose.model('Dowod', DowodSchema);
const Raport = mongoose.model('Raport', RaportSchema);
const Denat = mongoose.model('Denat', DenatSchema);
const Sprawa = mongoose.model('Sprawa', SprawaSchema);
const Nakaz = mongoose.model('Nakaz', NakazSchema);
const Organizacja = mongoose.model('Organizacja', OrganizacjaSchema);

// PUNKTY API (ENDPOINTHY)

// 1. Osoby / Kartoteka
app.get('/api/osoby', async (req, res) => {
  const osoby = await Kartoteka.find().sort({ imie: 1, nazwisko: 1 });
  res.json(osoby);
});

app.get('/api/osoby/podejrzani', async (req, res) => {
  const osoby = await Kartoteka.find({ status: { $in: ['PODEJRZANY', 'OSKARŻONY'] } });
  res.json(osoby);
});

app.get('/api/osoby/poszukiwani', async (req, res) => {
  const osoby = await Kartoteka.find({ status: 'POSZUKIWANY' });
  res.json(osoby);
});

app.get('/api/osoby/:pesel', async (req, res) => {
  const osoba = await Kartoteka.findOne({ pesel: req.params.pesel });
  if (!osoba) return res.status(404).json({ message: 'Nie znaleziono osoby.' });

  const dowody = await Dowod.find({ pesel: req.params.pesel });
  const raporty = await Raport.find({ pesel_podejrzanego: req.params.pesel });

  res.json({ osoba, dowody, raporty });
});

app.post('/api/osoby', async (req, res) => {
  try {
    const { imie, nazwisko, pesel } = req.body;
    const nowa = new Kartoteka({ imie: imie.toUpperCase(), nazwisko: nazwisko.toUpperCase(), pesel });
    await nowa.save();
    res.json({ success: true, message: 'Założono nowe akta osobowe.' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Osoba z tym numerem PESEL już istnieje.' });
  }
});

app.patch('/api/osoby/:pesel/status', async (req, res) => {
  await Kartoteka.updateOne({ pesel: req.params.pesel }, { status: req.body.status });
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/areszt', async (req, res) => {
  const { zarzuty, srodek, sledczy } = req.body;
  const data = new Date().toLocaleString('pl-PL');
  
  await Kartoteka.updateOne({ pesel: req.params.pesel }, { status: 'TYMCZASOWO ARESZTOWANY' });
  const raport = new Raport({
    pesel_podejrzanego: req.params.pesel,
    sledczy: sledczy || 'Oficer Operacyjny',
    data,
    tresc: `⚖️ [TA/Kaucja] Zarzuty: ${zarzuty} | Środek zapobiegawczy: ${srodek}`
  });
  await raport.save();
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/dowod', async (req, res) => {
  const { sygnatura, analiza, sledczy } = req.body;
  const dowod = new Dowod({
    sygnatura: sygnatura.toUpperCase(),
    pesel: req.params.pesel,
    opis: analiza,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await dowod.save();
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/notatka', async (req, res) => {
  const { notatka, sledczy } = req.body;
  const data = new Date().toLocaleDateString('pl-PL');
  const pelnyWpis = `[${data} - Śledczy ${sledczy || 'Oficer Operacyjny'}]: ${notatka}`;
  await Kartoteka.updateOne({ pesel: req.params.pesel }, { notatka_tajna: pelnyWpis });
  res.json({ success: true });
});

// 2. Sekcja Zwłok / Denaci
app.get('/api/denaci', async (req, res) => {
  const denaci = await Denat.find();
  res.json(denaci);
});

app.post('/api/denaci', async (req, res) => {
  const { imie_nazwisko, pesel, przyczyna, sledczy } = req.body;
  const denat = new Denat({
    dane: imie_nazwisko.toUpperCase(),
    pesel,
    opis: przyczyna,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await denat.save();

  if (pesel !== 'NIEZNANY') {
    await Kartoteka.updateOne({ pesel }, { status: 'DENAT' });
  }
  res.json({ success: true });
});

// 3. Śledztwa / Sprawy
app.get('/api/sprawy', async (req, res) => {
  const sprawy = await Sprawa.find();
  res.json(sprawy);
});

app.post('/api/sprawy', async (req, res) => {
  const { sygnatura, podejrzani, hipotezy, status, prowadzacy } = req.body;
  const nowaSprawa = new Sprawa({
    sygnatura: sygnatura.toUpperCase(),
    podejrzani,
    opis: hipotezy,
    status,
    prowadzacy: prowadzacy || 'Oficer Operacyjny',
    data: new Date().toLocaleDateString('pl-PL')
  });
  await nowaSprawa.save();
  res.json({ success: true });
});

app.put('/api/sprawy/:sygnatura', async (req, res) => {
  const { podejrzani, opis } = req.body;
  await Sprawa.updateOne({ sygnatura: req.params.sygnatura }, { podejrzani, opis });
  res.json({ success: true });
});

// 4. Nakazy / Postanowienia
app.get('/api/nakazy', async (req, res) => {
  const nakazy = await Nakaz.find();
  res.json(nakazy);
});

app.post('/api/nakazy', async (req, res) => {
  const { prokurator, cel, link, sledczy } = req.body;
  const nakaz = new Nakaz({
    prokurator: prokurator.toUpperCase(),
    cel: cel.toUpperCase(),
    link,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await nakaz.save();
  res.json({ success: true });
});

// 5. Grupy Przestępcze (ZGP)
app.get('/api/organizacje', async (req, res) => {
  const organizacje = await Organizacja.find();
  res.json(organizacje);
});

app.post('/api/organizacje', async (req, res) => {
  const { nazwa, typ, struktura, opis, wprowadzil } = req.body;
  const org = new Organizacja({
    nazwa: nazwa.toUpperCase(),
    typ: Array.isArray(typ) ? typ.join(', ') : typ.toUpperCase(),
    struktura,
    opis,
    wprowadzil: wprowadzil || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await org.save();
  res.json({ success: true });
});

app.put('/api/organizacje/:nazwa', async (req, res) => {
  const { typ, struktura, opis } = req.body;
  await Organizacja.updateOne({ nazwa: req.params.nazwa }, { typ: typ.toUpperCase(), struktura, opis });
  res.json({ success: true });
});

app.delete('/api/organizacje/:nazwa', async (req, res) => {
  await Organizacja.deleteOne({ nazwa: req.params.nazwa });
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`));
