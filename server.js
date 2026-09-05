const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Połączenie wyłącznie z bazą WDS_Database
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/WDS_Database';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Połączenie z MongoDB z wymuszeniem bazy WDS_Database
mongoose.connect(MONGO_URI, { dbName: 'WDS_Database' })
  .then(() => console.log(`✅ Połączono z bazą MongoDB: ${mongoose.connection.name}`))
  .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));

// ==========================================
// SCHEMATY I MODELE BAZY DANYCH
// ==========================================

const KartotekaSchema = new mongoose.Schema({
  imie: { type: String, required: true },
  nazwisko: { type: String, required: true },
  pesel: { type: String, unique: true, required: true, trim: true },
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
// ENDPOINTY API
// ==========================================

// 1. KARTOTEKA OSOBOWI
app.get('/api/osoby', async (req, res) => {
  try {
    const osoby = await Kartoteka.find().sort({ imie: 1, nazwisko: 1 });
    res.json(osoby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  try {
    const peselClean = req.params.pesel.trim();
    const osoba = await Kartoteka.findOne({ pesel: peselClean });
    if (!osoba) return res.status(404).json({ message: 'Nie znaleziono osoby w kartotece.' });

    const dowody = await Dowod.find({ pesel: peselClean });
    const raporty = await Raport.find({ pesel_podejrzanego: peselClean });

    res.json({ osoba, dowody, raporty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/osoby', async (req, res) => {
  try {
    const { imie, nazwisko, pesel } = req.body;
    const cleanPesel = pesel.trim();
    
    const isExist = await Kartoteka.findOne({ pesel: cleanPesel });
    if (isExist) {
      return res.status(400).json({ success: false, message: `PESEL ${cleanPesel} już istnieje w bazie.` });
    }

    const nowaOsoba = new Kartoteka({
      imie: imie.toUpperCase().trim(),
      nazwisko: nazwisko.toUpperCase().trim(),
      pesel: cleanPesel
    });

    await nowaOsoba.save();
    res.json({ success: true, message: 'Założono nowe akta osobowe.' });
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
  const dataWpisu = new Date().toLocaleString('pl-PL');
  
  await Kartoteka.updateOne({ pesel: peselClean }, { status: 'TYMCZASOWO ARESZTOWANY' });
  const raport = new Raport({
    pesel_podejrzanego: peselClean,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: dataWpisu,
    tresc: `⚖️ [TA/Kaucja] Zarzuty: ${zarzuty} | Środek zapobiegawczy: ${srodek}`
  });
  await raport.save();
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/dowod', async (req, res) => {
  const peselClean = req.params.pesel.trim();
  const { sygnatura, analiza, sledczy } = req.body;
  
  const dowod = new Dowod({
    sygnatura: sygnatura.toUpperCase().trim(),
    pesel: peselClean,
    opis: analiza,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await dowod.save();
  res.json({ success: true });
});

app.post('/api/osoby/:pesel/notatka', async (req, res) => {
  const peselClean = req.params.pesel.trim();
  const { notatka, sledczy } = req.body;
  const dataWpisu = new Date().toLocaleDateString('pl-PL');
  const pelnyWpis = `[${dataWpisu} - Śledczy ${sledczy || 'Oficer Operacyjny'}]: ${notatka}`;
  
  await Kartoteka.updateOne({ pesel: peselClean }, { notatka_tajna: pelnyWpis });
  res.json({ success: true });
});

app.delete('/api/osoby/:pesel', async (req, res) => {
  const peselClean = req.params.pesel.trim();
  await Kartoteka.deleteOne({ pesel: peselClean });
  await Dowod.deleteMany({ pesel: peselClean });
  await Raport.deleteMany({ pesel_podejrzanego: peselClean });
  res.json({ success: true, message: 'Usunięto kartotekę osobową wraz z podpiętymi aktami.' });
});

// 2. SEKCJA ZWŁOK / DENACI
app.get('/api/denaci', async (req, res) => {
  const denaci = await Denat.find().sort({ _id: -1 });
  res.json(denaci);
});

app.post('/api/denaci', async (req, res) => {
  const { imie_nazwisko, pesel, przyczyna, sledczy } = req.body;
  const peselClean = pesel ? pesel.trim() : 'NIEZNANY';
  
  const denat = new Denat({
    dane: imie_nazwisko.toUpperCase().trim(),
    pesel: peselClean,
    opis: przyczyna,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await denat.save();

  if (peselClean !== 'NIEZNANY') {
    await Kartoteka.updateOne({ pesel: peselClean }, { status: 'DENAT' });
  }
  res.json({ success: true });
});

// 3. ŚLEDZTWA / SPRAWY
app.get('/api/sprawy', async (req, res) => {
  const sprawy = await Sprawa.find().sort({ _id: -1 });
  res.json(sprawy);
});

app.post('/api/sprawy', async (req, res) => {
  try {
    const { sygnatura, podejrzani, hipotezy, status, prowadzacy } = req.body;
    const nowaSprawa = new Sprawa({
      sygnatura: sygnatura.toUpperCase().trim(),
      podejrzani,
      opis: hipotezy,
      status: status || 'W TOKU',
      prowadzacy: prowadzacy || 'Oficer Operacyjny',
      data: new Date().toLocaleDateString('pl-PL')
    });
    await nowaSprawa.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Sprawa o tej sygnaturze już istnieje.' });
  }
});

app.put('/api/sprawy/:sygnatura', async (req, res) => {
  const { podejrzani, opis, status } = req.body;
  await Sprawa.updateOne(
    { sygnatura: req.params.sygnatura.toUpperCase().trim() },
    { podejrzani, opis, status }
  );
  res.json({ success: true });
});

app.delete('/api/sprawy/:sygnatura', async (req, res) => {
  await Sprawa.deleteOne({ sygnatura: req.params.sygnatura.toUpperCase().trim() });
  res.json({ success: true });
});

// 4. NAKAZY I POSTANOWIENIA
app.get('/api/nakazy', async (req, res) => {
  const nakazy = await Nakaz.find().sort({ _id: -1 });
  res.json(nakazy);
});

app.post('/api/nakazy', async (req, res) => {
  const { prokurator, cel, link, sledczy } = req.body;
  const nakaz = new Nakaz({
    prokurator: prokurator.toUpperCase().trim(),
    cel: cel.toUpperCase().trim(),
    link,
    sledczy: sledczy || 'Oficer Operacyjny',
    data: new Date().toLocaleString('pl-PL')
  });
  await nakaz.save();
  res.json({ success: true });
});

// 5. GRUPY PRZESTĘPCZE (ZGP)
app.get('/api/organizacje', async (req, res) => {
  const organizacje = await Organizacja.find().sort({ nazwa: 1 });
  res.json(organizacje);
});

app.post('/api/organizacje', async (req, res) => {
  try {
    const { nazwa, typ, struktura, opis, wprowadzil } = req.body;
    const org = new Organizacja({
      nazwa: nazwa.toUpperCase().trim(),
      typ: Array.isArray(typ) ? typ.join(', ') : typ.toUpperCase().trim(),
      struktura,
      opis,
      wprowadzil: wprowadzil || 'Oficer Operacyjny',
      data: new Date().toLocaleString('pl-PL')
    });
    await org.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Grupa o tej nazwie już występuje w bazie.' });
  }
});

app.put('/api/organizacje/:nazwa', async (req, res) => {
  const { typ, struktura, opis } = req.body;
  await Organizacja.updateOne(
    { nazwa: req.params.nazwa.toUpperCase().trim() },
    { typ: typ.toUpperCase().trim(), struktura, opis }
  );
  res.json({ success: true });
});

app.delete('/api/organizacje/:nazwa', async (req, res) => {
  await Organizacja.deleteOne({ nazwa: req.params.nazwa.toUpperCase().trim() });
  res.json({ success: true });
});

// Start Serwera
app.listen(PORT, () => console.log(`🚀 Serwer WDŚ działa na porcie ${PORT}`));
