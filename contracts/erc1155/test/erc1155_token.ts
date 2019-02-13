
import {
    chaiSetup,
    constants,
    expectTransactionFailedAsync,
    expectTransactionFailedWithoutReasonAsync,
    LogDecoder,
    provider,
    txDefaults,
    web3Wrapper,
} from '@0x/contracts-test-utils';
import { BlockchainLifecycle } from '@0x/dev-utils';
import { RevertReason } from '@0x/types';
import { BigNumber } from '@0x/utils';
import * as chai from 'chai';
import { LogWithDecodedArgs } from 'ethereum-types';
import * as _ from 'lodash';

import {
    artifacts,
    DummyERC1155ReceiverContract,
   // DummyERC1155ReceiverTokenReceivedEventArgs,
    DummyERC1155TokenContract,
    //DummyERC1155TokenTransferEventArgs,
    InvalidERC1155ReceiverContract,
    ERC1155MixedFungibleMintableTransferSingleEventArgs
} from '../src';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);
// tslint:disable:no-unnecessary-type-assertion
describe('ERC1155Token', () => {

    const DUMMY_FUNGIBLE_TOKEN_URI = 'FUN';
    const DUMMY_FUNGIBLE_TOKEN_IS_FUNGIBLE = false;
    const DUMMY_NONFUNGIBLE_TOKEN_URI = 'NOFUN';

    let owner: string;
    let spender: string;
    const spenderInitialBalance = new BigNumber(500);
    const receiverInitialBalance = new BigNumber(0);
    let token: DummyERC1155TokenContract;
    let erc1155Receiver: DummyERC1155ReceiverContract;
    let logDecoder: LogDecoder;
    const tokenId = new BigNumber(1);


    let dummyFungibleTokenId: BigNumber;
    let dummyNonFungibleTokenId: BigNumber;

    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        owner = accounts[0];
        spender = accounts[1];
        token = await DummyERC1155TokenContract.deployFrom0xArtifactAsync(
            artifacts.DummyERC1155Token,
            provider,
            txDefaults,
            constants.DUMMY_TOKEN_NAME,
            constants.DUMMY_TOKEN_SYMBOL,
        );
        erc1155Receiver = await DummyERC1155ReceiverContract.deployFrom0xArtifactAsync(
            artifacts.DummyERC1155Receiver,
            provider,
            txDefaults,
        );
        logDecoder = new LogDecoder(web3Wrapper, artifacts);
        // Create fungible token
        const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
            await token.create.sendTransactionAsync(DUMMY_FUNGIBLE_TOKEN_URI, DUMMY_FUNGIBLE_TOKEN_IS_FUNGIBLE),
        );
        const createFungibleTokenLog = txReceipt.logs[0] as LogWithDecodedArgs<ERC1155MixedFungibleMintableTransferSingleEventArgs>;
        dummyFungibleTokenId = createFungibleTokenLog.args._id;
        console.log(`DUMMY FUNGIBLE TOKEN ID  = ${dummyFungibleTokenId}`);
        // Mint some fungible token
        await web3Wrapper.awaitTransactionSuccessAsync(
            await token.mintFungible.sendTransactionAsync(
                dummyFungibleTokenId,
                [spender],
                [spenderInitialBalance],
                { from: owner }
            ),
            constants.AWAIT_TRANSACTION_MINED_MS,
        );
        console.log(`ALL DONE SETUP`);
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('batchSafeTransferFrom', () => {
        it('should transfer fungible tokens if called by owner', async () => {
            // setup test parameters
            const from = spender;
            const to = erc1155Receiver.address;
            const fromIdx = 0;
            const toIdx = 1;
            const participatingOwners = [from, to];
            const participatingTokens = [dummyFungibleTokenId, dummyFungibleTokenId];
            const idsToTransfer = [dummyFungibleTokenId];
            const valueToTransfer = new BigNumber(200);
            const valuesToTransfer = [valueToTransfer];
            const calldata = constants.NULL_BYTES;
            // check balances before transfer
            const balancesBeforeTransfer = await token.balanceOfBatch.callAsync(participatingOwners, participatingTokens);
            expect(balancesBeforeTransfer[fromIdx]).to.be.bignumber.equal(spenderInitialBalance);
            expect(balancesBeforeTransfer[toIdx]).to.be.bignumber.equal(receiverInitialBalance);
            // execute transfer
            await web3Wrapper.awaitTransactionSuccessAsync(
                await token.safeBatchTransferFrom.sendTransactionAsync(from, to, idsToTransfer, valuesToTransfer, calldata, {from}),
                constants.AWAIT_TRANSACTION_MINED_MS,
            );
            // check balances after transfer
            const balancesAfterTransfer = await token.balanceOfBatch.callAsync(participatingOwners, participatingTokens);
            expect(balancesAfterTransfer[fromIdx]).to.be.bignumber.equal(balancesBeforeTransfer[fromIdx].minus(valueToTransfer));
            expect(balancesAfterTransfer[toIdx]).to.be.bignumber.equal(balancesBeforeTransfer[toIdx].plus(valueToTransfer));
        });
        it('should transfer non-fungible tokens if called by owner', async () => {

        });
        it('should transfer mix of fungible / non-fungible tokens if called by owner', async () => {

        });
        it('should trigger callback if transferring to a contract', async () => {

        });
    });
    /*
    describe('transferFrom', () => {
        it('should revert if the tokenId is not owner', async () => {
            const from = owner;
            const to = erc1155Receiver.address;
            const unownedTokenId = new BigNumber(2);
            await expectTransactionFailedAsync(
                token.transferFrom.sendTransactionAsync(from, to, unownedTokenId),
                RevertReason.Erc1155ZeroOwner,
            );
        });
        it('should revert if transferring to a null address', async () => {
            const from = owner;
            const to = constants.NULL_ADDRESS;
            await expectTransactionFailedAsync(
                token.transferFrom.sendTransactionAsync(from, to, tokenId),
                RevertReason.Erc1155ZeroToAddress,
            );
        });
        it('should revert if the from address does not own the token', async () => {
            const from = spender;
            const to = erc1155Receiver.address;
            await expectTransactionFailedAsync(
                token.transferFrom.sendTransactionAsync(from, to, tokenId),
                RevertReason.Erc1155OwnerMismatch,
            );
        });
        it('should revert if spender does not own the token, is not approved, and is not approved for all', async () => {
            const from = owner;
            const to = erc1155Receiver.address;
            await expectTransactionFailedAsync(
                token.transferFrom.sendTransactionAsync(from, to, tokenId, { from: spender }),
                RevertReason.Erc1155InvalidSpender,
            );
        });
        it('should transfer the token if called by owner', async () => {
            const from = owner;
            const to = erc1155Receiver.address;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.transferFrom.sendTransactionAsync(from, to, tokenId),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const log = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            expect(log.args._from).to.be.equal(from);
            expect(log.args._to).to.be.equal(to);
            expect(log.args._tokenId).to.be.bignumber.equal(tokenId);
        });
        it('should transfer the token if spender is approved for all', async () => {
            const isApproved = true;
            await web3Wrapper.awaitTransactionSuccessAsync(
                await token.setApprovalForAll.sendTransactionAsync(spender, isApproved),
                constants.AWAIT_TRANSACTION_MINED_MS,
            );

            const from = owner;
            const to = erc1155Receiver.address;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.transferFrom.sendTransactionAsync(from, to, tokenId),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const log = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            expect(log.args._from).to.be.equal(from);
            expect(log.args._to).to.be.equal(to);
            expect(log.args._tokenId).to.be.bignumber.equal(tokenId);
        });
        it('should transfer the token if spender is individually approved', async () => {
            await web3Wrapper.awaitTransactionSuccessAsync(
                await token.approve.sendTransactionAsync(spender, tokenId),
                constants.AWAIT_TRANSACTION_MINED_MS,
            );

            const from = owner;
            const to = erc1155Receiver.address;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.transferFrom.sendTransactionAsync(from, to, tokenId),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);

            const approvedAddress = await token.getApproved.callAsync(tokenId);
            expect(approvedAddress).to.be.equal(constants.NULL_ADDRESS);
            const log = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            expect(log.args._from).to.be.equal(from);
            expect(log.args._to).to.be.equal(to);
            expect(log.args._tokenId).to.be.bignumber.equal(tokenId);
        });
    });
    describe('safeTransferFrom without data', () => {
        it('should transfer token to a non-contract address if called by owner', async () => {
            const from = owner;
            const to = spender;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.safeTransferFrom1.sendTransactionAsync(from, to, tokenId),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const log = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            expect(log.args._from).to.be.equal(from);
            expect(log.args._to).to.be.equal(to);
            expect(log.args._tokenId).to.be.bignumber.equal(tokenId);
        });
        it('should revert if transferring to a contract address without onERC1155Received', async () => {
            const contract = await DummyERC1155TokenContract.deployFrom0xArtifactAsync(
                artifacts.DummyERC1155Token,
                provider,
                txDefaults,
                constants.DUMMY_TOKEN_NAME,
                constants.DUMMY_TOKEN_SYMBOL,
            );
            const from = owner;
            const to = contract.address;
            await expectTransactionFailedWithoutReasonAsync(
                token.safeTransferFrom1.sendTransactionAsync(from, to, tokenId),
            );
        });
        it('should revert if onERC1155Received does not return the correct value', async () => {
            const invalidErc1155Receiver = await InvalidERC1155ReceiverContract.deployFrom0xArtifactAsync(
                artifacts.InvalidERC1155Receiver,
                provider,
                txDefaults,
            );
            const from = owner;
            const to = invalidErc1155Receiver.address;
            await expectTransactionFailedAsync(
                token.safeTransferFrom1.sendTransactionAsync(from, to, tokenId),
                RevertReason.Erc1155InvalidSelector,
            );
        });
        it('should transfer to contract and call onERC1155Received with correct return value', async () => {
            const from = owner;
            const to = erc1155Receiver.address;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.safeTransferFrom1.sendTransactionAsync(from, to, tokenId),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const transferLog = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            const receiverLog = txReceipt.logs[1] as LogWithDecodedArgs<DummyERC1155ReceiverTokenReceivedEventArgs>;
            expect(transferLog.args._from).to.be.equal(from);
            expect(transferLog.args._to).to.be.equal(to);
            expect(transferLog.args._tokenId).to.be.bignumber.equal(tokenId);
            expect(receiverLog.args.operator).to.be.equal(owner);
            expect(receiverLog.args.from).to.be.equal(from);
            expect(receiverLog.args.tokenId).to.be.bignumber.equal(tokenId);
            expect(receiverLog.args.data).to.be.equal(constants.NULL_BYTES);
        });
    });
    describe('safeTransferFrom with data', () => {
        const data = '0x0102030405060708090a0b0c0d0e0f';
        it('should transfer token to a non-contract address if called by owner', async () => {
            const from = owner;
            const to = spender;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.safeTransferFrom2.sendTransactionAsync(from, to, tokenId, data),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const log = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            expect(log.args._from).to.be.equal(from);
            expect(log.args._to).to.be.equal(to);
            expect(log.args._tokenId).to.be.bignumber.equal(tokenId);
        });
        it('should revert if transferring to a contract address without onERC1155Received', async () => {
            const contract = await DummyERC1155TokenContract.deployFrom0xArtifactAsync(
                artifacts.DummyERC1155Token,
                provider,
                txDefaults,
                constants.DUMMY_TOKEN_NAME,
                constants.DUMMY_TOKEN_SYMBOL,
            );
            const from = owner;
            const to = contract.address;
            await expectTransactionFailedWithoutReasonAsync(
                token.safeTransferFrom2.sendTransactionAsync(from, to, tokenId, data),
            );
        });
        it('should revert if onERC1155Received does not return the correct value', async () => {
            const invalidErc1155Receiver = await InvalidERC1155ReceiverContract.deployFrom0xArtifactAsync(
                artifacts.InvalidERC1155Receiver,
                provider,
                txDefaults,
            );
            const from = owner;
            const to = invalidErc1155Receiver.address;
            await expectTransactionFailedAsync(
                token.safeTransferFrom2.sendTransactionAsync(from, to, tokenId, data),
                RevertReason.Erc1155InvalidSelector,
            );
        });
        it('should transfer to contract and call onERC1155Received with correct return value', async () => {
            const from = owner;
            const to = erc1155Receiver.address;
            const txReceipt = await logDecoder.getTxWithDecodedLogsAsync(
                await token.safeTransferFrom2.sendTransactionAsync(from, to, tokenId, data),
            );
            const newOwner = await token.ownerOf.callAsync(tokenId);
            expect(newOwner).to.be.equal(to);
            const transferLog = txReceipt.logs[0] as LogWithDecodedArgs<DummyERC1155TokenTransferEventArgs>;
            const receiverLog = txReceipt.logs[1] as LogWithDecodedArgs<DummyERC1155ReceiverTokenReceivedEventArgs>;
            expect(transferLog.args._from).to.be.equal(from);
            expect(transferLog.args._to).to.be.equal(to);
            expect(transferLog.args._tokenId).to.be.bignumber.equal(tokenId);
            expect(receiverLog.args.operator).to.be.equal(owner);
            expect(receiverLog.args.from).to.be.equal(from);
            expect(receiverLog.args.tokenId).to.be.bignumber.equal(tokenId);
            expect(receiverLog.args.data).to.be.equal(data);
        });
    });
    */
});
// tslint:enable:no-unnecessary-type-assertion