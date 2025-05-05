const express = require('express');
const neo4j = require('neo4j-driver');

const app = express();
const port = 3000;

// Connect to your Neo4j Aura DB
const driver = neo4j.driver(
  'neo4j+s://44bb5bca.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'your-password') // Replace with your actual Aura password
);

// Test route
app.get('/test', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('RETURN "Aura working!" AS message');
    res.send(result.records[0].get('message'));
  } catch (error) {
    console.error('Aura connection error:', error);
    res.status(500).send('Connection failed');
  } finally {
    await session.close();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
