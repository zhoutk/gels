export default {
    appenders: { 
        console: { type: 'console' },
        cheese: { type: 'file', filename: 'logs.log' } 
    },
    categories: { 
        default: { appenders: ['console', 'cheese'], level: 'debug' } 
    }
}