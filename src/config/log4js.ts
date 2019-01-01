export default {
    appenders: { 
        console: { type: 'console' },
        // file: { type: 'file', filename: 'logs.log' } 
    },
    categories: { 
        default: { appenders: ['console'], level: 'debug' } 
    }
}