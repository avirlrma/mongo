/**
 * Tests prepared transaction commit support.
 *
 * @tags: [uses_transactions]
 */
(function() {
    "use strict";
    load("jstests/core/txns/libs/prepare_helpers.js");

    const dbName = "test";
    const collName = "commit_prepared_transaction";
    const testDB = db.getSiblingDB(dbName);
    const testColl = testDB.getCollection(collName);

    testColl.drop();
    assert.commandWorked(testDB.runCommand({create: collName, writeConcern: {w: "majority"}}));

    const session = db.getMongo().startSession({causalConsistency: false});
    const sessionDB = session.getDatabase(dbName);
    const sessionColl = sessionDB.getCollection(collName);

    const doc1 = {_id: 1, x: 1};

    // ---- Test 1. Insert a single document and run prepare. ----

    session.startTransaction();
    assert.commandWorked(sessionColl.insert(doc1));

    // Insert should not be visible outside the session.
    assert.eq(null, testColl.findOne(doc1));

    // Insert should be visible in this session.
    assert.eq(doc1, sessionColl.findOne(doc1));

    let prepareTimestamp = PrepareHelpers.prepareTransaction(session);
    assert.commandWorked(PrepareHelpers.commitTransaction(session, prepareTimestamp));

    // After commit the insert persists.
    assert.eq(doc1, testColl.findOne(doc1));

    // ---- Test 2. Update a document and run prepare. ----

    session.startTransaction();
    assert.commandWorked(sessionColl.update(doc1, {$inc: {x: 1}}));

    const doc2 = {_id: 1, x: 2};

    // Update should not be visible outside the session.
    assert.eq(null, testColl.findOne(doc2));

    // Update should be visible in this session.
    assert.eq(doc2, sessionColl.findOne(doc2));

    prepareTimestamp = PrepareHelpers.prepareTransaction(session);
    assert.commandWorked(PrepareHelpers.commitTransaction(session, prepareTimestamp));

    // After commit the update persists.
    assert.eq(doc2, testColl.findOne({_id: 1}));

    // ---- Test 3. Delete a document and run prepare. ----

    session.startTransaction();
    assert.commandWorked(sessionColl.remove(doc2, {justOne: true}));

    // Delete should not be visible outside the session, so the document should be.
    assert.eq(doc2, testColl.findOne(doc2));

    // Document should not be visible in this session, since the delete should be visible.
    assert.eq(null, sessionColl.findOne(doc2));

    prepareTimestamp = PrepareHelpers.prepareTransaction(session);
    assert.commandWorked(PrepareHelpers.commitTransaction(session, prepareTimestamp));

    // After commit the delete persists.
    assert.eq(null, testColl.findOne(doc2));
}());
