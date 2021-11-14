// React and Semantic UI elements.
import React, { useState, useEffect } from 'react'
import { Form, Input, Grid, Message } from 'semantic-ui-react'

// Pre-built Substrate front-end utilities for connecting to a node
// and making a transaction.
import { useSubstrate } from './substrate-lib'
import { TxButton } from './substrate-lib/components'

// Polkadot-JS utilities for hashing data.
import { blake2AsHex } from '@polkadot/util-crypto'

// Main Proof Of Compliance component is exported.
export function Main(props) {
  // Establish an API to talk to the Substrate node.
  const { api } = useSubstrate()
  // Get the selected user from the `AccountSelector` component.
  const { accountPair } = props
  // React hooks for all the state variables we track.
  // Learn more at: https://reactjs.org/docs/hooks-intro.html
  const [status, setStatus] = useState('')
  const [digest, setDigest] = useState('')
  const [owner, setOwner] = useState('')
  const [block, setBlock] = useState(0)
  // Our `FileReader()` which is accessible from our functions below.
  let fileReader
  // Takes our file, and creates a digest using the Blake2 256 hash function
  const bufferToDigest = () => {
    // Turns the file content to a hexadecimal representation.
    const content = Array.from(new Uint8Array(fileReader.result))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    const hash = blake2AsHex(content, 256)
    setDigest(hash)
  }

  // Callback function for when a new file is selected.
  const handleFileChosen = file => {
    fileReader = new FileReader()
    fileReader.onloadend = bufferToDigest
    fileReader.readAsArrayBuffer(file)
  }

  // React hook to update the owner and block number information for a file
  useEffect(() => {
    let unsubscribe
    // Polkadot-JS API query to the `proofs` storage item in our pallet.
    // This is a subscription, so it will always get the latest value,
    // even if it changes.
    api.query.templateModule
      .proofs(digest, result => {
        // Our storage item returns a tuple, which is represented as an array.
        setOwner(result[0].toString())
        setBlock(result[1].toNumber())
      })
      .then(unsub => {
        unsubscribe = unsub
      })
    return () => unsubscribe && unsubscribe()
    // This tells the React hook to update whenever the file digest changes
    // (when a new file is chosen), or when the storage subscription says the
    // value of the storage item has updated.
  }, [digest, api.query.templateModule])

  // We can say a file digest is complianced if the stored block number is not 0
  function isComplianced() {
    return block !== 0
  }

  // The actual UI elements which are returned from our component.
  return (
    <Grid.Column>
      <h1>Proof of Compliance</h1>
      {/* Show warning or success message if the file is or is not complianced. */}
      <Form success={!!digest && !isComplianced()} warning={isComplianced()}>
        <Form.Field>
          {/* File selector with a callback to `handleFileChosen`. */}
          <Input
            type="file"
            id="file"
            label="Your File"
            onChange={e => handleFileChosen(e.target.files[0])}
          />
          {/* Show this message if the file is available to be complianced */}
          <Message success header="File Digest Uncomplianced" content={digest} />
          {/* Show this message if the file is already complianced. */}
          <Message
            warning
            header="File Digest Complianced"
            list={[digest, `Owner: ${owner}`, `Block: ${block}`]}
          />
        </Form.Field>
        {/* Buttons for interacting with the component. */}
        <Form.Field>
          {/* Button to create a compliance. Only active if a file is selected, and not already complianced. Updates the `status`. */}
          <TxButton
            accountPair={accountPair}
            label={'Create Compliance'}
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={isComplianced() || !digest}
            attrs={{
              palletRpc: 'templateModule',
              callable: 'createCompliance',
              inputParams: [digest],
              paramFields: [true],
            }}
          />
          {/* Button to revoke a compliance. Only active if a file is selected, and is already complianced. Updates the `status`. */}
          <TxButton
            accountPair={accountPair}
            label="Revoke Compliance"
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={!isComplianced() || owner !== accountPair.address}
            attrs={{
              palletRpc: 'templateModule',
              callable: 'revokeCompliance',
              inputParams: [digest],
              paramFields: [true],
            }}
          />
        </Form.Field>
        {/* Status message about the transaction. */}
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      </Form>
    </Grid.Column>
  )
}

export default function TemplateModule(props) {
  const { api } = useSubstrate()
  return api.query.templateModule && api.query.templateModule.proofs ? (
    <Main {...props} />
  ) : null
}