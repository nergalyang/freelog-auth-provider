/**
 * Created by yuliang on 2017/9/5.
 */

const moment = require('moment')
const rabbitClient = require('./helper/rabbit_mq_client')

module.exports = {
    get rabbitClient() {
        return rabbitClient.Instance
    },

    initRabbitClient(){
        return new rabbitClient(this.config.rabbitMq)
    },

    moment
}