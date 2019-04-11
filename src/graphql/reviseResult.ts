const customDefs = {
    textDefs: `
        type ReviseResult {
            id: Int
            affectedRows: Int
            status: Int
            message: String
        }
    `,
    queryDefs: [],
    mutationDefs: []
}

const customResolvers = { 
    Query: {
    },
    Mutation: {
    }
 }

export { customDefs, customResolvers }