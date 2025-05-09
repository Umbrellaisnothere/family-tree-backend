const db = require('./database');

function addPerson(name, birthDate, deathDate, image, gender, relationship, parent_Id, callback) {
    const query = `INSERT INTO Person (name, birthDate, deathDate, image, gender, relationship, parent_Id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [name, birthDate, deathDate, image, gender, relationship, parent_Id], function(err) {
        if (err) {
            console.error('Error adding person: ' + err.message);
        } else {
            console.log(`Person added with ID: ${this.lastID}`);
            if (callback) callback(this.lastID);
        }
    });
}


function addRelationship(personId1, personId2, type) {
    const query = `INSERT INTO Relationship (personId1, personId2, type) VALUES (?, ?, ?)`;
    db.run(query, [personId1, personId2, type], function(err) {
        if (err) {
            console.error('Error adding relationship: ', err.message);
        } else {
            console.log(`Relationship added with ID: ${this.lastID}`);
        }
    });
}

// An Example usage
addPerson('John Doe', '1980-01-01', null, 'https://picsum.photos/80', 'male', null, null, (johnId) => {
    addPerson('Jane Doe', '1985-05-15', null, 'https://picsum.photos/81', 'female', null, null, (janeId) => {
        addRelationship(johnId, janeId, 'spouse');

        addPerson('Little Doe', '2010-01-01', null, null, 'female', null, johnId, (childId) => {
            console.log('Child added:', childId);
            addRelationship(johnId, childId, 'parent');
        });
    });
});