const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/WDS_Database';

app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGO_URI, { dbName: 'WDS_Database' })
  .then(() => console.log(`✅ Połączono z bazą MongoDB: ${mongoose.connection.name}`))
  .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));

// ==========================================
// SCHEMATY
// ==========================================

const KartotekaSchema = new mongoose.Schema({
  imie: { type: String, required: true },
  nazwisko: { type: String, required: true },
  pesel: { type: String, unique: true, required: true, trim: true },
  status: { type: String, default: 'CZYSTY' },
  zdjecie: { type: String, default: '' },
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
  sygnatura: { type: String, unique: true, required: true },
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
  nazwa: { type: String, unique: true, required: true },
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

// ==========================================
// ENDPOINTY - KARTOTEKA
// ==========================================

app.get('/api/osoby', async (req, res) => {
  const osoby = await Kartoteka.find().sort({ nazwisko: 1 });
  res.json(osoby);
});

app.get('/api/osoby/:pesel', async (req, res) => {
  try {
    const peselClean = req.params.pesel.trim();
    const osoba = await Kartoteka.findOne({ pesel: peselClean });
    if (!osoba) return res.status(404).json({ message: 'Nie znaleziono osoby.' });

    const dowody = await Dowod.find({ pesel: peselClean });
    const raporty = await Raport.find({ pesel_podejrzanego: peselClean });
    res.json({ osoba, dowody, raporty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/osoby', async (req, res) => {
  try {
    const { imie, nazwisko, pesel, zdjecieBase64 } = req.body;
    const cleanPesel = pesel.trim();
    const isExist = await Kartoteka.findOne({ pesel: cleanPesel });
    if (isExist) return res.status(400).json({ success: false, message: `PESEL ${cleanPesel} już istnieje.` });

    const nowaOsoba = new Kartoteka({
      imie: imie.toUpperCase().trim(),
      nazwisko: nazwisko.toUpperCase().trim(),
      pesel: cleanPesel,
      zdjecie: zdjecieBase64 || ''
    });

    await nowaOsoba.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.patch('/api/osoby/:pesel/status', async (req, res) => {
  await Kartoteka.updateOne({ pesel: req.params.pesel.trim() }, { status: req.body.status });
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/areszt', async (req, res) => {
  const peselClean = req.params.pesel.trim();
  const { zarzuty, srodek, sledczy } = req.body;
  await Kartoteka.updateOne({ pesel: peselClean }, { status: 'TYMCZASOWO ARESZTOWANY' });
  const raport = new Raport({
    pesel_podejrzanego: peselClean,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL'),
    tresc: `⚖️ [Zastosowano środki zapobiegawcze] Zarzuty: ${zarzuty} | Środek: ${srodek}`
  });
  await raport.save();
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/dowod', async (req, res) => {
  const dowod = new Dowod({
    sygnatura: req.body.sygnatura.toUpperCase().trim(),
    pesel: req.params.pesel.trim(),
    opis: req.body.analiza,
    sledczy: req.body.sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await dowod.save();
  res.json({ success: true });
});

app.delete('/api/osoby/:pesel', async (req, res) => {
  const peselClean = req.params.pesel.trim();
  await Kartoteka.deleteOne({ pesel: peselClean });
  await Dowod.deleteMany({ pesel: peselClean });
  await Raport.deleteMany({ pesel_podejrzanego: peselClean });
  res.json({ success: true });
});

// ==========================================
// ENDPOINTY - SEKCJA ZWŁOK / ŚLEDZTWA / NAKAZY / GRUPY
// ==========================================

app.get('/api/denaci', async (req, res) => res.json(await Denat.find().sort({ _id: -1 })));
app.post('/api/denaci', async (req, res) => {
  const peselClean = req.body.pesel ? req.body.pesel.trim() : 'NIEZNANY';
  const denat = new Denat({
    dane: req.body.imie_nazwisko.toUpperCase().trim(),
    pesel: peselClean,
    opis: req.body.przyczyna,
    sledczy: req.body.sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await denat.save();
  if (peselClean !== 'NIEZNANY') await Kartoteka.updateOne({ pesel: peselClean }, { status: 'DENAT' });
  res.json({ success: true });
});

app.get('/api/sprawy', async (req, res) => res.json(await Sprawa.find().sort({ _id: -1 })));
app.post('/api/sprawy', async (req, res) => {
  try {
    const sprawa = new Sprawa({
      sygnatura: req.body.sygnatura.toUpperCase().trim(),
      podejrzani: req.body.podejrzani,
      opis: req.body.hipotezy,
      status: req.body.status || 'W TOKU',
      prowadzacy: req.body.prowadzacy || 'Oficer Operacyjny',
      data: new Date().toLocaleDateString('pl-PL')
    });
    await sprawa.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Sygnatura już występuje.' });
  }
});

app.get('/api/nakazy', async (req, res) => res.json(await Nakaz.find().sort({ _id: -1 })));
app.post('/api/nakazy', async (req, res) => {
  const nakaz = new Nakaz({
    prokurator: req.body.prokurator.toUpperCase().trim(),
    cel: req.body.cel.toUpperCase().trim(),
    link: req.body.link,
    sledczy: req.body.sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await nakaz.save();
  res.json({ success: true });
});

app.get('/api/organizacje', async (req, res) => res.json(await Organizacja.find().sort({ nazwa: 1 })));
app.post('/api/organizacje', async (req, res) => {
  try {
    const org = new Organizacja({
      nazwa: req.body.nazwa.toUpperCase().trim(),
      typ: req.body.typ.toUpperCase().trim(),
      struktura: req.body.struktura,
      opis: req.body.opis,
      wprowadzil: req.body.wprowadzil || 'Oficer Operacyjny',
      data: new Date().toLocaleString('pl-PL')
    });
    await org.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Grupa o tej nazwie już istnieje.' });
  }
});

app.listen(PORT, () => console.log(`🚀 System WDŚ działa na porcie ${PORT}`));
