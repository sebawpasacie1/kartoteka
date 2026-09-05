const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();

// Połączenie z bazą MongoDB za pomocą zmiennej MongoURI
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("BŁĄD: Brak zmiennej środowiskowej MONGO_URI!");
}

mongoose.connect(mongoURI)
  .then(() => console.log('Połączono z bazą MongoDB!'))
  .catch(err => console.error('Błąd połączenia z MongoDB:', err));

// Definicja Schematów MongoDB
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const recordSchema = new mongoose.Schema({
  title: String,
  content: String,
  status: String,
  created_by: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Record = mongoose.model('Record', recordSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'tajny_klucz_terminala',
  resave: false,
  saveUninitialized: false
}));

app.use(express.static('public'));

// Rejestracja nowego konta
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Uzupełnij login i hasło.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.json({ success: true, message: 'Konto utworzone! Możesz się zalogować.' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Użytkownik o takim loginie już istnieje.' });
  }
});

// Logowanie
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user._id;
      req.session.username = user.username;
      res.json({ success: true, username: user.username });
    } else {
      res.status(401).json({ success: false, message: 'Błędny login lub hasło.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Błąd serwera.' });
  }
});

// Pobieranie wpisów z kartoteki
app.get('/api/records', async (req, res) => {
  try {
    const records = await Record.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Dodawanie wpisu
app.post('/api/records', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Niezalogowany' });
  const { title, content, status } = req.body;
  try {
    const newRecord = new Record({
      title,
      content,
      status,
      created_by: req.session.username
    });
    await newRecord.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Endpoint dla UptimeRobot
app.get('/ping', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Terminal działa na porcie ${PORT}`));