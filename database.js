const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./family_tree.db', (err) => {
    if (err) {
    console.error('Error opening database ' + err.message);
  } else {
    console.log('Successfully connected to the database.');
  }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Person (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birthDate TEXT NOT NULL,
        deathDate TEXT, --REMOVE 'NOT NULL',
        image TEXT,
        gender TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating Person table: ' + err.message);
        } else {
            console.log('Person table created or already exists.');
        }
    });

    // db.run(`DROP TABLE IF EXISTS Relationship`);
    db.run(`CREATE TABLE IF NOT EXISTS Relationship (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personId1 INTEGER,
        personId2 INTEGER,
        type TEXT,
        FOREIGN KEY(personId1) REFERENCES Person(id),
        FOREIGN KEY(personId2) REFERENCES Person(id)
    )`, (err) => {
        if (err) {
            console.error('Error creating Relationship table: ' + err.message);
        } else {
            console.log('Relationship table created or already exists.');
        }
    });
});

module.exports = db;