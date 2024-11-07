import React from 'react';
import './App.css';

import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Navbar from 'react-bootstrap/Navbar';
import DeezyLogo from './assets/images/Logo-No-Text.svg';


const App = () => {
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
            <br/><br/>
            <b>Sorry - the swap service is no longer operational</b>
            <br/><br/>
          </Card>
        </Container>
      </Container>
    </>
  )
}

export default App;
