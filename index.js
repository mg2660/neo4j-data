const express = require('express');
const {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLList
} = require('graphql');
const axios = require('axios');

const baseURL = 'https://cognizantdemo4.service-now.com/api/now/table';
const auth = {
  username: 'your_username',
  password: 'your_password'
};

// Model Category Type
const CategoryType = new GraphQLObjectType({
  name: 'Category',
  fields: () => ({
    sys_id: { type: GraphQLString },
    name: { type: GraphQLString }
  })
});

// Product Model Type
const ProductModelType = new GraphQLObjectType({
  name: 'ProductModel',
  fields: () => ({
    name: { type: GraphQLString },
    model_number: { type: GraphQLString },
    manufacturer: {
      type: GraphQLString,
      resolve: async (parent) => {
        if (!parent.manufacturer?.value) return null;
        const res = await axios.get(`${baseURL}/core_company/${parent.manufacturer.value}`, { auth });
        return res.data.result.name;
      }
    },
    model_categories: {
      type: new GraphQLList(CategoryType),
      resolve: async (parent) => {
        const ids = parent.cmdb_model_category?.split(',') || [];
        const categories = await Promise.all(ids.map(async (id) => {
          const res = await axios.get(`${baseURL}/cmdb_model_category/${id}`, { auth });
          return {
            sys_id: id,
            name: res.data.result.name
          };
        }));
        return categories;
      }
    }
  })
});

// Root Query
const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    productModels: {
      type: new GraphQLList(ProductModelType),
      resolve: async () => {
        const res = await axios.get(`${baseURL}/sn_ni_core_equipment_product_model?sysparm_limit=10`, { auth });
        return res.data.result;
      }
    }
  }
});

// Schema
const schema = new GraphQLSchema({
  query: RootQuery
});

// Express App
const app = express();
app.use('/graphql', require('express-graphql')({
  schema,
  graphiql: true
}));

app.listen(4000, () => {
  console.log('GraphQL Server running on http://localhost:4000/graphql');
});
