def getUserData(userId):
    query = "SELECT * FROM users WHERE id = " + str(userId)
    return db.execute(query)
