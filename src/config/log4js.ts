export default {
    appenders: { cheese: { type: 'file', filename: 'logs.log' } },
    categories: { default: { appenders: ['cheese'], level: 'debug' } }
}