const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Tworzenie katalogu na zdjęcia, jeśli nie istnieje
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfiguracja zapisu plików przez Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `foto_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/WDS_Database';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(MONGO_URI, { dbName: 'WDS_Database' })
  .then(() => console.log(`✅ Połączono z bazą MongoDB: ${mongoose.connection.name}`))
  .catch(err => console.error('❌ Błąd połączenia z MongoDB:', err));

// SCHEMAT KARTOTEKI Z POLEM ZDJĘCIA
const KartotekaSchema = new mongoose.Schema({
  imie: { type: String, required: true },
  nazwisko: { type: String, required: true },
  pesel: { type: String, unique: true, required: true, trim: true },
  status: { type: String, default: 'CZYSTY' },
  zdjecie: { type: String, default: '/uploads/default_avatar.png' },
  notatka_tajna: { type: String, default: 'Brak uwag operacyjnych.' }
}, { collection: 'wds_kartoteka_osob' });

const Kartoteka = mongoose.model('Kartoteka', KartotekaSchema);

// POBIERANIE WSZYSTKICH OSOB
app.get('/api/osoby', async (req, res) => {
  try {
    const osoby = await Kartoteka.find().sort({ nazwisko: 1 });
    res.json(osoby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DODAWANIE OSOBY ZE ZDJĘCIEM
app.post('/api/osoby', upload.single('zdjecie_file'), async (req, res) => {
  try {
    const { imie, nazwisko, pesel, zdjecie_url } = req.body;
    const cleanPesel = pesel.trim();

    let zdjeciePath = '/uploads/default_avatar.png';
    if (req.file) {
      zdjeciePath = `/uploads/${req.file.filename}`;
    } else if (zdjecie_url && zdjecie_url.trim() !== '') {
      zdjeciePath = zdjecie_url.trim();
    }

    const nowaOsoba = new Kartoteka({
      imie: imie.toUpperCase().trim(),
      nazwisko: nazwisko.toUpperCase().trim(),
      pesel: cleanPesel,
      zdjecie: zdjeciePath
    });

    await nowaOsoba.save();
    res.json({ success: true, message: 'Wpis został zarejestrowany w systemie WDŚ.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 System WDŚ uruchomiony na porcie ${PORT}`));
