const customDefs = `
    type ReviseResult {
        id: Int
        affectedRows: Int
        status: Int
        message: String
    }
`

let queryDefs = []

const customResolvers = { Query: {} }

export { customDefs, queryDefs, customResolvers }