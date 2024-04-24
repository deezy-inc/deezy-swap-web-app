import React, { useState, useRef, useEffect } from 'react';
import './App.css';

import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Modal from 'react-bootstrap/Modal';
import { FaRegCopy } from 'react-icons/fa';
import InputGroup from 'react-bootstrap/InputGroup';
import { TailSpin } from 'react-loading-icons'
import { QRCodeSVG } from 'qrcode.react';
import Countdown from 'react-countdown';
import useInterval from 'react-useinterval';
import Image from 'react-bootstrap/Image';
import { validate, Network } from 'bitcoin-address-validation';
import GreenCheck from './assets/images/green-check.gif';
import DeezyLogo from './assets/images/Logo-No-Text.svg';

// const { parsePaymentRequest } = require('invoices')
const axios = require('axios').default;

const TESTNET = false
const API_BASE_URL = `https://api${TESTNET ? '-testnet' : ''}.deezy.io`

const DISCORD_URL = "https://discord.gg/nEBbrUAvPy"
const NODE_AMBOSS_URL = "https://amboss.space/node/024bfaf0cabe7f874fd33ebf7c6f4e5385971fc504ef3f492432e9e3ec77e1b5cf"
const TWITTER_URL = "https://twitter.com/dannydiekroeger"
const TELEGRAM_URL = "https://t.me/dannydeezy"
const EMAIL = "dannydiekroeger@gmail.com"
const DEFAULT_LIQUIDITY_FEE_PPM = 1500
const DEFAULT_VBYTES_PER_SWAP = 300
const SATS_PER_BTC = 100000000
const DEFAULT_CHAIN_SWAP_SATS = 25000000
const MIN_SWAP_FEE_RATE = 8
const MAX_SWAP_FEE_RATE = 2000
const DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE = 40
const DEFAULT_USE_SATS = false
const INVOICE_EXPIRY_MS = 1000 * 60 * 60 * 12 // 12 hr
const NODE_ID = "024bfaf0cabe7f874fd33ebf7c6f4e5385971fc504ef3f492432e9e3ec77e1b5cf"
const CLEARNET_NODE_URI = `${NODE_ID}@52.1.72.207:9735`

function checkIsAccessTokenValid(token) {
  return token && token.match(/[0-9A-Fa-f]{32}/g)
}

const App = () => {
  const [copiedVisible, setCopiedVisible] = useState(false)
  const [nodeLinkType, setNodeLinkType] = useState("#clearnet")
  const [showPayModal, setShowPayModal] = useState(false)
  const [showProvideAddressModal, setShowProvideAddressModal] = useState(false)
  const [showEnterAccessTokenModal, setShowEnterAccessTokenModal] = useState(false)
  const [showConfirmSwapModal, setShowConfirmSwapModal] = useState(false)
  const [showAwaitingInvoiceModal, setShowAwaitingInvoiceModal] = useState(false)
  const [showSwapCompleteModal, setShowSwapCompleteModal] = useState(false)
  const [showCopiedNode, setShowCopiedNode] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [destinationBtcAddress, setDestinationBtcAddress] = useState("")
  const [invoiceToPay, setInvoiceToPay] = useState("")
  const copyNodeTarget = useRef(null)
  const [swapInfo, setSwapInfo] = useState({
    liquidity_fee_ppm: DEFAULT_LIQUIDITY_FEE_PPM,
    on_chain_bytes_estimate: DEFAULT_VBYTES_PER_SWAP,
    max_swap_amount_sats: DEFAULT_CHAIN_SWAP_SATS * 10,
    min_swap_amount_sats: 100000,
    available: true
  })
  const [invoiceDetails, setInvoiceDetails] = useState({})
  const [paidOnChainTxid, setPaidOnChainTxid] = useState(null)
  const [isBtcInputAddressValid, setIsBtcInputAddressValid] = useState(true)
  const savedAccessToken = localStorage.getItem('access-token')
  const [isAccessTokenValid, setIsAccessTokenValid] = useState(checkIsAccessTokenValid(savedAccessToken))
  const [accessToken, setAccessToken] = useState(savedAccessToken)

  const [ready, setReady] = useState(false)

  const defaultChainSwapAmountSats = DEFAULT_CHAIN_SWAP_SATS
  const defaultLightningSwapAmountSats = getLightningAmountFromChainAmount(DEFAULT_CHAIN_SWAP_SATS, DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE)
  const defaultTotalFeeSats = defaultLightningSwapAmountSats - defaultChainSwapAmountSats
  const [swapParams, setSwapParams] = useState({
    lightningSwapAmountSats: defaultLightningSwapAmountSats,
    feeOnChainSatsPerVbyte: DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE,
    totalFeeSats: defaultTotalFeeSats,
    feeNetPpm: Math.round(defaultTotalFeeSats * 1000000 / DEFAULT_CHAIN_SWAP_SATS),
    chainSwapAmountSats: DEFAULT_CHAIN_SWAP_SATS,
    lightningSwapAmountDisplay: DEFAULT_USE_SATS ? defaultLightningSwapAmountSats : defaultLightningSwapAmountSats * 1.0 / SATS_PER_BTC,
    chainSwapAmountDisplay: DEFAULT_USE_SATS ? DEFAULT_CHAIN_SWAP_SATS : DEFAULT_CHAIN_SWAP_SATS * 1.0 / SATS_PER_BTC,
    useSatsForSwapDisplay: DEFAULT_USE_SATS
  })

  useEffect(() => {
    async function fetchSwapInfo() {
      const { data } = await axios.get(`${API_BASE_URL}/v1/swap/info`)
      setSwapInfo(data)
      const newLightningSwapAmountSats = getLightningAmountFromChainAmount(swapParams.chainSwapAmountSats, swapParams.feeOnChainSatsPerVbyte, data.on_chain_bytes_estimate, data.liquidity_fee_ppm)
      const newTotalFeeSats = newLightningSwapAmountSats - swapParams.chainSwapAmountSats
      updateSwapParams({
        newLightningSwapAmountSats,
        newFeeOnChainSatsPerByte: swapParams.feeOnChainSatsPerVbyte,
        newTotalFeeSats,
        newChainSwapAmountSats: swapParams.chainSwapAmountSats,
        newUseSatsForSwapDisplay: swapParams.useSatsForSwapDisplay
      })
      setReady(true)
    }
    fetchSwapInfo()
  }, []);

  const fetchPaymentStatusLoop = async () => {
    if (!showPayModal) return
    console.log(`polling for invoice status`)
    let response = null
    try {
      response = await axios.get(`${API_BASE_URL}/v1/swap/lookup?bolt11_invoice=${invoiceToPay}`)
    } catch (err) {
      console.error(err)
    }
    console.log(response)
    if (response && response.data && response.data.on_chain_txid) {
      setPaidOnChainTxid(response.data.on_chain_txid)
      setShowPayModal(false)
      setShowSwapCompleteModal(true)
    }
  }

  useInterval(fetchPaymentStatusLoop, 1000)

  function calculateLiquidityFee(lightningSwapAmountSats, liqFeePpm) {
    return Math.round((lightningSwapAmountSats * liqFeePpm / 1000000))
  }
  function calculateChainFee(onChainFeeSatsPerVbyte, bytesPerSwap) {
    return onChainFeeSatsPerVbyte * bytesPerSwap
  }
  function calculateTotalFeeSats(lightningSwapAmountSats, onChainFeeSatsPerVbyte, liqFeePpm, bytesPerSwap) {
    const liqFeeSats = calculateLiquidityFee(lightningSwapAmountSats, liqFeePpm)
    return calculateChainFee(onChainFeeSatsPerVbyte, bytesPerSwap) + liqFeeSats
  }

  // TODO: validate inputs, make sure they match the lambda constraints
  // TODO: GET current fee rates from lambda endpoint.

  if (copiedVisible) {
    setTimeout(() => {
      setCopiedVisible(false)
    }, 1000)
  }

  if (showCopiedNode) {
    setTimeout(() => {
      setShowCopiedNode(false)
    }, 1000)
  }

  function copyEmail() {
    navigator.clipboard.writeText(EMAIL);
    setCopiedVisible(true)
  }

  function copyNodeInfo() {
    navigator.clipboard.writeText(getNodeUri());
    setShowCopiedNode(true)
  }

  function copyInvoiceToPay() {
    navigator.clipboard.writeText(invoiceToPay)
  }

  function toggleSats() {
    updateSwapParams({
      newLightningSwapAmountSats: swapParams.lightningSwapAmountSats,
      newFeeOnChainSatsPerByte: swapParams.feeOnChainSatsPerVbyte,
      newTotalFeeSats: swapParams.totalFeeSats,
      newChainSwapAmountSats: swapParams.chainSwapAmountSats,
      newUseSatsForSwapDisplay: !swapParams.useSatsForSwapDisplay
    })
  }

  function satsOrBtcLabel() {
    return swapParams.useSatsForSwapDisplay ? 'sats' : 'btc'
  }

  async function initiateSwap() {
    setIsBtcInputAddressValid(true)
    setShowProvideAddressModal(true)
  }

  function handleFeeRateChange(evt) {
    const newFeeOnChainSatsPerByte = evt.target.value
    const newLightningSwapAmountSats = swapParams.lightningSwapAmountSats
    const newChainSwapAmountSats = getChainAmountFromLightningAmount(newLightningSwapAmountSats, newFeeOnChainSatsPerByte)
    const newTotalFeeSats = newLightningSwapAmountSats - newChainSwapAmountSats
    const newUseSatsForSwapDisplay = swapParams.useSatsForSwapDisplay
    updateSwapParams({ newLightningSwapAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newChainSwapAmountSats, newUseSatsForSwapDisplay })
  }

  function getChainAmountFromLightningAmount(lightningAmountSats, feeOnChainSatsPerVbyte, onChainBytesEstimate = swapInfo.on_chain_bytes_estimate, liquidityFeePpm = swapInfo.liquidity_fee_ppm) {
    return Math.round(1000000 * (lightningAmountSats - (onChainBytesEstimate * feeOnChainSatsPerVbyte)) / (1000000 + liquidityFeePpm))
  }

  function getLightningAmountFromChainAmount(chainAmountSats, feeOnChainSatsPerVbyte, onChainBytesEstimate = swapInfo.on_chain_bytes_estimate, liquidityFeePpm = swapInfo.liquidity_fee_ppm) {
    return Math.round(chainAmountSats + (onChainBytesEstimate * feeOnChainSatsPerVbyte) + (liquidityFeePpm * chainAmountSats / 1000000))
  }

  function handleLightningSwapAmountChange(evt) {
    const newLightningSwapVal = evt.target.value
    const newFeeOnChainSatsPerByte = swapParams.feeOnChainSatsPerVbyte
    let newLightningSwapAmountSats = swapParams.useSatsForSwapDisplay ? parseInt(newLightningSwapVal) : parseFloat(newLightningSwapVal) * 1.0 * SATS_PER_BTC
    const newChainSwapAmountSats = getChainAmountFromLightningAmount(newLightningSwapAmountSats, swapParams.feeOnChainSatsPerVbyte)
    // Recalculate to ensure we have no rounding issues.
    newLightningSwapAmountSats = getLightningAmountFromChainAmount(newChainSwapAmountSats, swapParams.feeOnChainSatsPerVbyte)
    const newTotalFeeSats = newLightningSwapAmountSats - newChainSwapAmountSats
    const newUseSatsForSwapDisplay = swapParams.useSatsForSwapDisplay
    updateSwapParams({ newLightningSwapAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newChainSwapAmountSats, newUseSatsForSwapDisplay })
  }

  function handleChainSwapAmountChange(evt) {
    const newChainSwapVal = evt.target.value
    const newFeeOnChainSatsPerByte = swapParams.feeOnChainSatsPerVbyte
    const newChainSwapAmountSats = swapParams.useSatsForSwapDisplay ? parseInt(newChainSwapVal) : parseFloat(newChainSwapVal) * 1.0 * SATS_PER_BTC
    const newLightningSwapAmountSats = getLightningAmountFromChainAmount(newChainSwapAmountSats, swapParams.feeOnChainSatsPerVbyte)
    const newTotalFeeSats = newLightningSwapAmountSats - newChainSwapAmountSats
    const newUseSatsForSwapDisplay = swapParams.useSatsForSwapDisplay
    updateSwapParams({ newLightningSwapAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newChainSwapAmountSats, newUseSatsForSwapDisplay })
  }

  function getNodeUri() {
    return CLEARNET_NODE_URI
  }

  function updateSwapParams({ newLightningSwapAmountSats, newFeeOnChainSatsPerByte, newTotalFeeSats, newChainSwapAmountSats, newUseSatsForSwapDisplay }) {
    setSwapParams({
      lightningSwapAmountSats: newLightningSwapAmountSats,
      feeOnChainSatsPerVbyte: newFeeOnChainSatsPerByte,
      totalFeeSats: newTotalFeeSats,
      feeNetPpm: Math.round(newTotalFeeSats * 1000000 / newChainSwapAmountSats),
      chainSwapAmountSats: newChainSwapAmountSats,
      lightningSwapAmountDisplay: newUseSatsForSwapDisplay ? newLightningSwapAmountSats : newLightningSwapAmountSats * 1.0 / SATS_PER_BTC,
      chainSwapAmountDisplay: newUseSatsForSwapDisplay ? newChainSwapAmountSats : Math.round(newChainSwapAmountSats * 1.0) * 1.0 / SATS_PER_BTC,
      useSatsForSwapDisplay: newUseSatsForSwapDisplay
    })
  }

  function handleBtcAddressChange(evt) {
    const newaddr = evt.target.value
    if (newaddr === '') {
      setIsBtcInputAddressValid(true)
      return
    }
    if (!validate(newaddr, TESTNET ? Network.testnet : Network.mainnet)) {
      setIsBtcInputAddressValid(false)
      return
    }
    setDestinationBtcAddress(newaddr)
    setShowProvideAddressModal(false)
    setShowEnterAccessTokenModal(true)
  }

  function handleAccessTokenChange(evt) {
    const newtoken = evt.target.value
    // validate newtoken is 32 digit hex
    if (!checkIsAccessTokenValid(newtoken)) {
      setIsAccessTokenValid(false)
      return
    }
    setIsAccessTokenValid(true)
    setAccessToken(newtoken)
  }

  async function handleConfirmSwap() {
    setShowConfirmSwapModal(false)
    setShowAwaitingInvoiceModal(true)
    let response
    try {
      response = await axios.post(`${API_BASE_URL}/v1/swap`,
        {
          amount_sats: parseInt(swapParams.chainSwapAmountSats),
          on_chain_address: destinationBtcAddress,
          on_chain_sats_per_vbyte: parseInt(swapParams.feeOnChainSatsPerVbyte)
        }, {
        headers: {
          'x-api-token': accessToken,
        }
      })
    } catch (err) {
      setShowAwaitingInvoiceModal(false)
      setShowErrorModal(true)
      return
    }
    console.log(response)
    const invoice = response.data.bolt11_invoice
    setInvoiceToPay(invoice)
    // const parsedInvoice = parsePaymentRequest({ request: invoice })
    // console.log(parsedInvoice)
    // Note: this is a hack because we had trouble decoding invoice in browser, we are just
    // assuming the expiry is 2 minutes from now.
    setInvoiceDetails({
      // description: parsedInvoice.description,
      expiresAt: Date.now() + INVOICE_EXPIRY_MS//new Date(parsedInvoice.expires_at)
    })
    setShowAwaitingInvoiceModal(false)
    setShowPayModal(true)
    // TODO: pay modal needs to poll until invoice is paid
    // TODO: pay modal should show invoice expiration countdown
    // TODO: pay modal should show QR code for invoice
  }

  function handleConfirmAccessToken() {
    localStorage.setItem('access-token', accessToken)
    setShowEnterAccessTokenModal(false)
    setShowConfirmSwapModal(true)
  }

  function swapSummary() {
    return (
      <>
        <b>sending:</b> {(swapParams.lightningSwapAmountSats).toLocaleString()} ⚡ sats<br /><br />
        <b>receiving:</b> {swapParams.chainSwapAmountSats.toLocaleString()} ⛓️ sats<br /><br />
        <b>total fee:</b> {swapParams.totalFeeSats.toLocaleString()} sats ({swapParams.feeNetPpm} ppm)<br /><br />
        <b>receive to address:</b> {destinationBtcAddress}<br /><br />
      </>
    )
  }

  const countdownRenderer = ({ hours, minutes, seconds, completed }) => {
    if (completed) {
      // Render a completed state
      return <span>the invoice has expired</span>;
    } else {
      // Render a countdown
      return <span>expires in: {hours > 0 ? `${hours}h` : ''} {minutes > 0 ? `${minutes}m` : ''} {seconds}s</span>;
    }
  };

  function isValidSwapParams() {
    return swapParams.chainSwapAmountSats <= swapInfo.max_swap_amount_sats && swapParams.chainSwapAmountSats >= swapInfo.min_swap_amount_sats
  }

  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand style={{ margin: 'auto' }} onClick={() => window.open('https://deezy.io', '_self')}>
            <img
              alt=""
              src={DeezyLogo}
              height="100"
              className="align-top my-2"
            />{' '}
          </Navbar.Brand>
        </Container>
      </Navbar>
      <Container fluid className="main-container d-flex flex-column text-center align-items-center justify-content-center pt-5">
        <Container fluid>
          <br />
          <Card id="swap-section" className="section" fluid bg="dark" text="white" variant="dark">
            <Card.Header style={{ borderBottom: '1px solid gray', marginBottom: '20px' }} className="card-header py-4">
              <Card.Title>
                <b>Swap instantly</b> to get <b>inbound liquidity</b>
              </Card.Title>
            </Card.Header>
            {ready ?
              <>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <InputGroup hasValidation className="input-group mb-3 w-100 swap-option">
                    <InputGroup.Text className="w-25 in-text">send</InputGroup.Text>
                    <Form.Control type="number" className="in-text" step={swapParams.useSatsForSwapDisplay ? 1000000 : 0.01} onChange={handleLightningSwapAmountChange} value={swapParams.lightningSwapAmountDisplay} required isInvalid={!isValidSwapParams()} />
                    <InputGroup.Text className="input-group-text hover in-text" onClick={toggleSats}>⚡ {satsOrBtcLabel()}</InputGroup.Text>
                  </InputGroup>
                  <InputGroup hasValidation className="input-group mb-3 w-100 swap-option">
                    <InputGroup.Text className="w-25 in-text">receive</InputGroup.Text>
                    <Form.Control type="number" className="in-text" step={swapParams.useSatsForSwapDisplay ? 1000000 : 0.01} onChange={handleChainSwapAmountChange} value={swapParams.chainSwapAmountDisplay} required isInvalid={!isValidSwapParams()} />
                    <InputGroup.Text className="input-group-text hover in-text" onClick={toggleSats}>⛓️ {satsOrBtcLabel()}</InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      {
                        swapParams.chainSwapAmountSats < swapInfo.min_swap_amount_sats ?
                          `min swap is ${swapParams.useSatsForSwapDisplay ? swapInfo.min_swap_amount_sats : swapInfo.min_swap_amount_sats * 1.0 / SATS_PER_BTC} ${satsOrBtcLabel()}`
                          :
                          `max swap is ${swapParams.useSatsForSwapDisplay ? swapInfo.max_swap_amount_sats : swapInfo.max_swap_amount_sats * 1.0 / SATS_PER_BTC} ${satsOrBtcLabel()}`
                      }
                    </Form.Control.Feedback>
                  </InputGroup>
                  <Form.Label className="swap-option"><div className="small-text" id="fee-info">{swapParams.feeOnChainSatsPerVbyte} sat/vbyte on-chain fee rate</div></Form.Label>
                  <Form.Range className="swap-option" min={MIN_SWAP_FEE_RATE} defaultValue={DEFAULT_ON_CHAIN_FEE_RATE_SATS_PER_VBYTE} max={MAX_SWAP_FEE_RATE} onChange={handleFeeRateChange} />
                  <Form.Label className="swap-option"><div className="small-text" id="fee-info">{swapParams.totalFeeSats.toLocaleString()} total sat fee ({Math.round(swapParams.feeNetPpm).toLocaleString()} ppm)</div></Form.Label>
                  <br />

                  <Button className="w-50 centered" disabled={!isValidSwapParams()} onClick={initiateSwap}>Swap</Button>
                </Card.Body>
                <br />
                <Card.Footer className="py-4" style={{ borderTop: '1px solid gray' }}>
                  <Card.Title>
                    or <b><a style={{ color: 'white' }} href="https://channel.deezy.io/" target="_blank">Buy a channel</a></b>
                  </Card.Title>
                </Card.Footer>
              </>
              :
              <>
                <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
              </>
            }
          </Card>
          <br />
          <br />
          <Card id="node-section" className="section" bg="dark" text="white">
            <Card.Header style={{ borderBottom: '1px solid gray' }}>
              <Card.Title className="py-3">
                <b>Open a channel</b> with <b>Deezy</b>:
              </Card.Title>
              <Nav variant="pills" defaultActiveKey={nodeLinkType} onSelect={(s) => setNodeLinkType(s)}>
                <Nav.Item>
                  <Nav.Link eventKey="#clearnet">Clearnet</Nav.Link>
                </Nav.Item>
              </Nav>
            </Card.Header>
            <Card.Body>
              <Card.Text className="node-text">
                {getNodeUri()}
                <br />
                <br />
                <Button ref={copyNodeTarget} onClick={copyNodeInfo} variant="outline-primary"><FaRegCopy /> copy</Button>
              </Card.Text>
            </Card.Body>
          </Card>
          <br />
          <br />
          <br />
          <Modal show={showProvideAddressModal} onHide={() => setShowProvideAddressModal(false)} className="modal py-5">
            <Modal.Header closeButton className="modal-header p-4" >
              <Modal.Title>enter receive address</Modal.Title>
            </Modal.Header>
            <Modal.Body className="modal-body p-4">
              <div>provide a fresh btc address to receive the on-chain funds</div><br />
              <InputGroup className="mb-3">
                <Form.Control onChange={handleBtcAddressChange}
                  placeholder="paste btc address here"
                  aria-label="paste btc address heres"
                  aria-describedby="basic-addon2"
                  isInvalid={!isBtcInputAddressValid}
                  autoFocus
                />
                <Form.Control.Feedback type="invalid">
                  <br />that is not a valid {TESTNET ? 'testnet' : 'mainnet'} btc address
                </Form.Control.Feedback>
              </InputGroup>
            </Modal.Body>
          </Modal>
          <Modal show={showEnterAccessTokenModal} onHide={() => setShowEnterAccessTokenModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>enter access token</Modal.Title>
            </Modal.Header>
            <Modal.Body className="modal-body p-4">
              <div>an access token will be required to perform deezy swaps</div><br />
              <InputGroup className="mb-3">
                <Form.Control onChange={handleAccessTokenChange}
                  placeholder="paste access token here"
                  defaultValue={accessToken}
                  aria-label="paste access token here"
                  aria-describedby="basic-addon2"
                  isInvalid={!isAccessTokenValid}
                  autoFocus
                />
              </InputGroup>
              <div className="small-text">get a token by emailing support@deezy.io</div><br />
              <div className="small-text"></div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEnterAccessTokenModal(false)}>
                cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmAccessToken} disabled={!isAccessTokenValid}>
                confirm
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showConfirmSwapModal} onHide={() => setShowConfirmSwapModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>confirm details?</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3">
              {swapSummary()}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowConfirmSwapModal(false)}>
                cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmSwap}>
                confirm
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showAwaitingInvoiceModal} onHide={() => setShowAwaitingInvoiceModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>preparing swap...</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents">
              <br /><br />
              <TailSpin stroke="#000000" speed={.75} />
              <br /><br /><br />
            </Modal.Body>
          </Modal>
          <Modal show={showPayModal} onHide={() => setShowPayModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>pay invoice to complete swap</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents modal-body">
              <QRCodeSVG size="240" value={`lightning:${invoiceToPay}`} />
              <br /><br />
              <Countdown date={new Date(invoiceDetails.expiresAt)} renderer={countdownRenderer} />
              <br /><br />
              <Button onClick={copyInvoiceToPay} variant="outline-primary"><FaRegCopy /> copy</Button>
              <br /><br />
              <span className="small-text">{invoiceToPay}</span>
            </Modal.Body>
          </Modal>
          <Modal show={showSwapCompleteModal} onHide={() => setShowSwapCompleteModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>swap complete</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents modal-body">
              <div>
                <Image id="check-image" src={GreenCheck} alt="green check" />
              </div>
              <br />
              txid: <a className="small-text" target="_blank" href={`https://mempool.space/${TESTNET ? 'testnet/' : ''}tx/${paidOnChainTxid}`}>{paidOnChainTxid}</a>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="primary" onClick={() => setShowSwapCompleteModal(false)}>
                done
              </Button>
            </Modal.Footer>
          </Modal>
          <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} className="py-5">
            <Modal.Header closeButton className="p-4">
              <Modal.Title>error</Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-5 py-3 center-contents">
              oops something went wrong
            </Modal.Body>
          </Modal>
        </Container>
        <br />
        <br /><br /><br />
      </Container>
    </>
  )
}

export default App;
