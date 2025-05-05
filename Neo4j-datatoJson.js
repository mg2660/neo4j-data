// server.js
const express = require('express');
const neo4j = require('neo4j-driver');

const app = express();
const port = 3000;

// Neo4j connection
const driver = neo4j.driver(
  'bolt://localhost:7687',  // or your Neo4j URI
  neo4j.auth.basic('neo4j', 'your-password') // credentials
);

app.get('/graph-data', async (req, res) => {
  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (n)-[r]->(m)
      WITH collect(n) + collect(m) AS nodes, collect(r) AS rels
      CALL apoc.graph.fromData(nodes, rels, 'myGraph', {}) YIELD graph
      CALL apoc.export.json.graph(graph, "", {stream: true}) YIELD data
      RETURN data
    `);

    const jsonData = result.records[0].get('data');
    res.json(JSON.parse(jsonData));
  } catch (error) {
    console.error('Neo4j query error:', error);
    res.status(500).send('Error fetching graph data');
  } finally {
    await session.close();
  }
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}/graph-data`);
});
