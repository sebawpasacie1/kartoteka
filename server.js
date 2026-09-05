const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/WDS_Database';

// Zwiększenie limitu JSON, aby baza mogła przyjmować duże zdjęcia Base64
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGO_URI, { dbName: 'WDS_Database' })
  .then(() => console.log(`✅ Połączono z bazą MongoDB: ${mongoose.connection.name}`))
  .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));

const KartotekaSchema = new mongoose.Schema({
  imie: { type: String, required: true },
  nazwisko: { type: String, required: true },
  pesel: { type: String, unique: true, required: true, trim: true },
  status: { type: String, default: 'CZYSTY' },
  zdjecie: { type: String, default: '' },
  notatka_tajna: { type: String, default: 'Brak uwag operacyjnych.' }
}, { collection: 'wds_kartoteka_osob' });

const Kartoteka = mongoose.model('Kartoteka', KartotekaSchema);

app.get('/api/osoby', async (req, res) => {
  try {
    const osoby = await Kartoteka.find().sort({ nazwisko: 1 });
    res.json(osoby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/osoby', async (req, res) => {
  try {
    const { imie, nazwisko, pesel, zdjecieBase64 } = req.body;
    const cleanPesel = pesel.trim();

    const exist = await Kartoteka.findOne({ pesel: cleanPesel });
    if (exist) {
      return res.status(400).json({ success: false, message: 'Podany PESEL istnieje w bazie.' });
    }

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

app.listen(PORT, () => console.log(`🚀 Serwer uruchomiony na porcie ${PORT}`));
