'use strict'
const express = require('express')
const axios = require('axios')
const router = express.Router()
const db = require('../models/mongodb')
const { Validator } = require('../models/blockchain/validator')
const { HDWalletProvider } = require('../helpers')
const PrivateKeyProvider = require('truffle-privatekey-provider')
const config = require('config')

router.get('/', async function (req, res, next) {
    const limit = (req.query.limit) ? parseInt(req.query.limit) : 150
    const skip = (req.query.page) ? limit * (req.query.page - 1) : 0
    try {
        let validator = await Validator.deployed()

        let data = await Promise.all([
            db.Candidate.find({
                smartContractAddress: validator.address
            }).limit(limit).skip(skip).lean().exec(),
            db.Signer.findOne({}).sort({ _id: 'desc' })
        ])

        let candidates = data[0]
        let latestSigners = data[1]

        const signers = (latestSigners || {}).signers || []
        const set = new Set()
        for (let i = 0; i < signers.length; i++) {
            set.add(signers[i])
        }

        let map = candidates.map(async c => {
            // is masternode
            c.isMasternode = set.has(c.candidate)
            return c
        })
        let ret = await Promise.all(map)

        return res.json(ret)
    } catch (e) {
        return next(e)
    }
})

router.get('/:candidate', async function (req, res, next) {
    let validator = await Validator.deployed()
    let address = (req.params.candidate || '').toLowerCase()
    let candidate = (await db.Candidate.findOne({
        smartContractAddress: validator.address,
        candidate: address
    }) || {})

    return res.json(candidate)
})

router.get('/:candidate/voters', async function (req, res, next) {
    let validator = await Validator.deployed()
    const limit = (req.query.limit) ? parseInt(req.query.limit) : 100
    const skip = (req.query.page) ? limit * (req.query.page - 1) : 0
    let voters = await db.Voter.find({
        smartContractAddress: validator.address,
        candidate: (req.params.candidate || '').toLowerCase()
    }).limit(limit).skip(skip)
    return res.json(voters)
})

router.get('/:candidate/rewards', async function (req, res, next) {
    const limit = (req.query.limit) ? parseInt(req.query.limit) : 100
    const skip = (req.query.page) ? limit * (req.query.page - 1) : 0
    let rewards = await db.MnReward.find({
        address: (req.params.candidate || '').toLowerCase()
    }).sort({ _id: -1 }).limit(limit).skip(skip)
    return res.json(rewards)
})

// for automation test only
router.post('/apply', async function (req, res, next) {
    let key = req.query.key
    let network = config.get('blockchain.rpc')
    try {
        let walletProvider =
            (key.indexOf(' ') >= 0)
                ? new HDWalletProvider(key, network)
                : new PrivateKeyProvider(key, network)
        Validator.setProvider(walletProvider)
        let validator = await Validator.deployed()
        let candidate = req.query.coinbase.toLowerCase()
        await validator.propose(req.query.coinbase, {
            from : walletProvider.address,
            value: 50000 * 10 ** 18,
            gas: 2000000,
            gasPrice: 2500
        })
        if (req.query.name) {
            await db.Candidate.updateOne({
                smartContractAddress: validator.address,
                candidate: candidate
            }, {
                $set: {
                    smartContractAddress: validator.address,
                    candidate: candidate,
                    capacity: '50000000000000000000000',
                    status: 'PROPOSED',
                    owner: walletProvider.address,
                    name: req.query.name
                }
            }, { upsert: true })
        }
        return res.json({ status: 'OK' })
    } catch (e) {
        return res.json({ status: 'NOK' })
    }
})

// for automation test only
router.post('/applyBulk', async function (req, res, next) {
    let key = req.query.key
    let network = config.get('blockchain.rpc')
    try {
        let walletProvider =
            (key.indexOf(' ') >= 0)
                ? new HDWalletProvider(key, network)
                : new PrivateKeyProvider(key, network)
        Validator.setProvider(walletProvider)
        let validator = await Validator.deployed()

        let candidates = (req.query.candidates || '').split(',')

        for (let candidate of candidates) {
            candidate = (candidate || '').trim().toLowerCase()
            try {
                await validator.propose(candidate, {
                    from : walletProvider.address,
                    value: 50000 * 10 ** 18,
                    gas: 2000000,
                    gasPrice: 2500
                })
                if (req.query.name) {
                    await db.Candidate.updateOne({
                        smartContractAddress: validator.address,
                        candidate: candidate
                    }, {
                        $set: {
                            smartContractAddress: validator.address,
                            candidate: candidate,
                            capacity: '50000000000000000000000',
                            status: 'PROPOSED',
                            owner: walletProvider.address,
                            name: req.query.name
                        }
                    }, { upsert: true })
                }
            } catch (e) {
                console.log(e)
            }
        }
        return res.json({ status: 'OK' })
    } catch (e) {
        return res.json({ status: 'NOK' })
    }
})

// for automation test only
router.post('/resign', async function (req, res, next) {
    let key = req.query.key
    let network = config.get('blockchain.rpc')
    try {
        let walletProvider =
            (key.indexOf(' ') >= 0)
                ? new HDWalletProvider(key, network)
                : new PrivateKeyProvider(key, network)
        Validator.setProvider(walletProvider)
        let validator = await Validator.deployed()
        let candidate = req.query.coinbase.toLowerCase()
        await validator.resign(candidate, {
            from : walletProvider.address,
            gas: 2000000,
            gasPrice: 2500
        })
        return res.json({ status: 'OK' })
    } catch (e) {
        return res.json({ status: 'NOK' })
    }
})

// for automation test only
router.post('/vote', async function (req, res, next) {
    let key = req.query.key
    let network = config.get('blockchain.rpc')
    try {
        let walletProvider =
            (key.indexOf(' ') >= 0)
                ? new HDWalletProvider(key, network)
                : new PrivateKeyProvider(key, network)
        Validator.setProvider(walletProvider)
        let validator = await Validator.deployed()
        let candidate = req.query.coinbase.toLowerCase()
        await validator.vote(candidate, {
            from : walletProvider.address,
            value: '500000000000000000000',
            gas: 2000000,
            gasPrice: 2500
        })
        return res.json({ status: 'OK' })
    } catch (e) {
        return res.json({ status: 'NOK' })
    }
})

// for automation test only
router.post('/unvote', async function (req, res, next) {
    let key = req.query.key
    let network = config.get('blockchain.rpc')
    try {
        let walletProvider =
            (key.indexOf(' ') >= 0)
                ? new HDWalletProvider(key, network)
                : new PrivateKeyProvider(key, network)
        Validator.setProvider(walletProvider)
        let validator = await Validator.deployed()
        let candidate = req.query.coinbase.toLowerCase()
        await validator.unvote(candidate, '200000000000000000000', {
            from : walletProvider.address,
            gas: 2000000,
            gasPrice: 2500
        })
        return res.json({ status: 'OK' })
    } catch (e) {
        return res.json({ status: 'NOK' })
    }
})

router.get('/:candidate/isMasternode', async function (req, res, next) {
    try {
        let latestSigners = await db.Signer.findOne({}).sort({ _id: 'desc' })
        const signers = latestSigners.signers
        const set = new Set()
        for (let i = 0; i < signers.length; i++) {
            set.add(signers[i])
        }
        let isMasternode = (set.has(req.params.candidate || '')) ? 1 : 0

        return res.json(isMasternode)
    } catch (e) {
        return next(e)
    }
})

router.get('/:candidate/isCandidate', async function (req, res, next) {
    try {
        let validator = await Validator.deployed()
        let isCandidate = await validator.isCandidate.call(req.params.candidate)
        return res.json((isCandidate) ? 1 : 0)
    } catch (e) {
        return next(e)
    }
})

// Get masternode rewards
router.get('/:candidate/:owner/getRewards', async function (req, res, next) {
    try {
        const candidate = req.params.candidate
        const owner = req.params.owner
        const limit = 100
        const rewards = await axios.post(
            `${config.get('tomoscanUrl')}/api/expose/rewards`,
            {
                address: candidate,
                limit,
                owner: owner,
                reason: 'MasterNode'
            }
        )
        res.json(rewards.data)
    } catch (e) {
        return next(e)
    }
})

module.exports = router
