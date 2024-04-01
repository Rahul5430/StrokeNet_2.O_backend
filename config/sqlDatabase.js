// database.js

const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "nitin@123",
  database: "strokenet_test",
});

async function executeQuery(sql, values) {
  const connection = await pool.promise().getConnection();

  try {
    // Execute the query
    const [results, fields] = await connection.query(sql, values);
    return results;
  } catch (error) {
    throw new Error(`Error executing query: ${error}`);
  } finally {
    connection.release(); // Release the connection back to the pool
  }
}

module.exports = {
  executeQuery,
};
