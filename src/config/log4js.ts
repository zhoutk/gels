export default {
    appenders: { 
        console: { type: 'console' },
        file: { type: 'dateFile', filename: 'logs/app.log', pattern: '.yyyy-MM-dd', alwaysIncludePattern: true }
    },
    categories: { 
        default: { appenders: process.env.NODE_ENV === 'prod' ? ['console', 'file'] : ['console'], level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug' } 
    }
}