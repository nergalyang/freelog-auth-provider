/**
 * Created by yuliang on 2017/8/16.
 */

'use strict'

const contractFsmEventHandler = require('../../contract-service/contract-fsm-event-handler')

module.exports = app => {
    return class ContractController extends app.Controller {

        /**
         * 当前登录用户的合约列表(作为甲方和作为乙方)
         * @param ctx
         * @returns {Promise.<void>}
         */
        async index(ctx) {
            let page = ctx.checkQuery("page").default(1).gt(0).toInt().value
            let pageSize = ctx.checkQuery("pageSize").default(10).gt(0).lt(101).toInt().value
            let contractType = ctx.checkQuery('contractType').default(0).in([0, 1, 2, 3]).value

            let condition = {
                $or: [{partyOne: ctx.request.userId}, {partyTwo: ctx.request.userId}]
            }

            if (contractType) {
                condition.contractType = contractType
            }

            await ctx.validate().service.contractService.getContractList(condition).bind(ctx).map(buildReturnContract)
                .then(ctx.success).catch(ctx.error)
        }

        /**
         * 展示合约信息
         * @param ctx
         * @returns {Promise.<void>}
         */
        async show(ctx) {
            let contractId = ctx.checkParams("id").notEmpty().isMongoObjectId().value

            await ctx.validate().service.contractService.getContractById(contractId).bind(ctx).then(buildReturnContract)
                .then(ctx.success).catch(ctx.error)
        }

        /**
         * 创建资源合约
         * @param ctx
         * @returns {Promise.<void>}
         */
        async create(ctx) {
            let contractType = ctx.checkBody('contractType').in([1, 2, 3]).value
            let segmentId = ctx.checkBody('segmentId').exist().isMd5().value
            let serialNumber = ctx.checkBody('serialNumber').exist().isMongoObjectId().value
            let policyId = ctx.checkBody('policyId').exist().notEmpty().isMongoObjectId().value

            await ctx.validate().service.contractService.getContract({
                targetId: policyId,
                partyTwo: ctx.request.userId,
                segmentId: segmentId,
                expireDate: {$gt: new Date()},
                status: 0
            }).then(oldContract => {
                oldContract && ctx.error({msg: "已经存在一份同样的合约,不能重复签订"})
            })

            let policyInfo = await ctx.curlIntranetApi(contractType === ctx.app.contractType.PresentableToUer
                ? `${ctx.app.config.gatewayUrl}/api/v1/presentables/${policyId}`
                : `${ctx.app.config.gatewayUrl}/api/v1/resources/policies/${policyId}`)

            if (!policyInfo) {
                ctx.error({msg: 'policyId错误'})
            }
            if (policyInfo.serialNumber !== serialNumber) {
                ctx.error({msg: 'serialNumber不匹配,policy已变更,变更时间' + new Date(policyInfo.updateDate).toLocaleString()})
            }
            policyInfo.expireDate = new Date(policyInfo.expireDate)
            if (policyInfo.expireDate < new Date()) {
                ctx.error({msg: '策略已过期'})
            }
            let policySegment = policyInfo.policy.find(t => t.segmentId === segmentId)
            if (!policySegment) {
                ctx.error({msg: 'segmentId错误,未找到策略段'})
            }

            let contractModel = {
                segmentId, policySegment, contractType,
                targetId: policyId,
                resourceId: policyInfo.resourceId,
                partyTwo: ctx.request.userId,
                expireDate: policyInfo.expireDate,
                languageType: policyInfo.languageType,
                partyOne: contractType === ctx.app.contractType.PresentableToUer
                    ? policyInfo.nodeId
                    : policyInfo.userId
            }

            let policyTextBuffer = new Buffer(policyInfo.policyText, 'utf8')

            /**
             * 保持策略原文副本,以备以后核查
             */
            await ctx.app.upload.putBuffer(`contracts/${serialNumber}.txt`, policyTextBuffer).then(url => {
                contractModel.policyCounterpart = url
            })

            await ctx.service.contractService.createContract(contractModel).then(contractInfo => {
                contractFsmEventHandler.initContractFsm(contractInfo.toObject())
            }).bind(ctx).then(buildReturnContract).then(ctx.success).catch(ctx.error)
        }

        /**
         * 用户签订的presentable合约
         * @param ctx
         * @returns {Promise.<void>}
         */
        async userContracts(ctx) {
            let page = ctx.checkQuery("page").default(1).gt(0).toInt().value
            let pageSize = ctx.checkQuery("pageSize").default(10).gt(0).lt(101).toInt().value
            let userId = ctx.checkParams("userId").exist().isInt().value
            let presentableId = ctx.checkQuery("presentableId").isMongoObjectId().value

            await ctx.validate().service.contractService.getContractList({
                partyTwo: userId,
                targetId: presentableId,
                contractType: ctx.app.contractType.PresentableToUer,
                expireDate: {$gt: new Date()},
                status: 0
            }, page, pageSize).bind(ctx).map(buildReturnContract).then(ctx.success).catch(ctx.error)
        }

        /**
         * 节点商与资源商签订的合约
         * @param ctx
         * @returns {Promise.<void>}
         */
        async nodeContracts(ctx) {
            let page = ctx.checkQuery("page").default(1).gt(0).toInt().value
            let pageSize = ctx.checkQuery("pageSize").default(10).gt(0).lt(101).toInt().value
            let nodeId = ctx.checkParams("nodeId").exist().isInt().value
            let resourceId = ctx.checkQuery("resourceId").exist().isResourceId().value

            await ctx.validate().service.contractService.getContractList({
                partyTwo: nodeId,
                targetId: resourceId,
                contractType: ctx.app.contractType.ResourceToNode,
                expireDate: {$gt: new Date()},
                status: 0
            }, page, pageSize).bind(ctx).map(buildReturnContract).then(ctx.success).catch(ctx.error)
        }

        /**
         * 资源商与资源商签订的合约
         * @param ctx
         * @returns {Promise.<void>}
         */
        async authorContracts(ctx) {
            let page = ctx.checkQuery("page").default(1).gt(0).toInt().value
            let pageSize = ctx.checkQuery("pageSize").default(10).gt(0).lt(101).toInt().value
            let authorId = ctx.checkParams("authorId").exist().isInt().value
            let resourceId = ctx.checkQuery("resourceId").exist().isResourceId().value

            await ctx.validate().service.contractService.getContractList({
                partyTwo: authorId,
                targetId: resourceId,
                contractType: ctx.app.contractType.ResourceToResource
            }, page, pageSize).bind(ctx).map(buildReturnContract).then(ctx.success).catch(ctx.error)
        }

        /**
         * 测试状态机事件驱动
         * @param ctx
         * @returns {Promise.<void>}
         */
        async testContractFsm(ctx) {
            let contractId = ctx.checkBody('contractId').exist().notEmpty().isMongoObjectId().value
            let events = ctx.checkBody('events').notEmpty().value

            ctx.allowContentType({type: 'json'}).validate()

            await contractFsmEventHandler.contractTest(contractId, events).then(data => {
                ctx.success(data)
            })
        }
    }
}

const buildReturnContract = (data) => {
    if (data) {
        data = data.toObject()
        Reflect.deleteProperty(data, 'languageType')
        Reflect.deleteProperty(data, 'policyCounterpart')
    }
    return data
}