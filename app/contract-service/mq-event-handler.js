/**
 * Created by yuliang on 2017/9/5.
 */

'use strict'

const rabbitClient = require('../extend/helper/rabbit_mq_client')

module.exports = {
    /**
     * 支付合同事件处理
     * @param message
     * @param headers
     * @param deliveryInfo
     * @param messageObject
     */
    paymentContractHandler(message, headers, deliveryInfo, messageObject){
        /**
         * 此处直接调用contract-fsm的payment事件.
         * 信息经过支付中心加密处理,此处考虑不再校验数据
         */
        console.log("合同支付事件", headers.eventName)
        //messageObject.acknowledge(false)
    },

    /**
     * 账户充值处理
     * @param message
     * @param headers
     * @param deliveryInfo
     * @param messageObject
     */
    accountRechargeHandler(message, headers, deliveryInfo, messageObject){
        /**
         * 此处需要系统自动检索 自动扣费的合同.
         * 然后把需要自动扣费的合同发送到支付中心的执行付款队列中
         * 如果扣款成功,则支付中心会发送支付合同事件,业务由支付合同事件handler来处理
         * 如果扣款失败,则忽略或者做扣款日志记录
         */
        console.log("账户充值事件", headers.eventName)

        rabbitClient.Instance.publish({routingKey: 'pay.tryPaymentContract', eventName: 'tryPaymentContractEvent', body: {test: '去试试支付合同'}})
            .catch(console.log)
    },

    /**
     * 合同超时未执行成功
     * @param message
     * @param headers
     * @param deliveryInfo
     * @param messageObject
     */
    contractTimeoutHandler(message, headers, deliveryInfo, messageObject){
        /**
         * 合同超过限期依然未成功执行.
         * 此处调用contract-fsm的expire事件.
         */
        console.log("合同超时未执行事件", deliveryInfo)
    }
}
