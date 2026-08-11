const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

const ROLE = 42n;

async function fixture() {
  const [manager] = await ethers.getSigners();

  const clones = await ethers.deployContract('$Clones');
  const implementation = await ethers.deployContract('$RoleAccount');
  const args = ethers.solidityPacked(['address', 'uint64'], [manager.address, ROLE]);

  const cloneWithArgs = async args => {
    const instance = await clones.$cloneWithImmutableArgs.staticCall(implementation, args);
    await clones.$cloneWithImmutableArgs(implementation, args);
    return implementation.attach(instance);
  };

  return { manager, clones, implementation, args, cloneWithArgs };
}

// Note that most tests related to RoleAccount are in test/account/RoleAccountFactory.test.js
describe('RoleAccount', function () {
  beforeEach(async function () {
    Object.assign(this, await loadFixture(fixture));
  });

  it('should revert if called directly', async function () {
    await expect(this.implementation.accessManager()).to.be.revertedWithCustomError(
      this.implementation,
      'DirectCallNotAllowed',
    );
    await expect(this.implementation.roleId()).to.be.revertedWithCustomError(
      this.implementation,
      'DirectCallNotAllowed',
    );
  });

  it('should revert if deployed via clones without immutable args', async function () {
    const account = await this.clones.$clone
      .staticCall(this.implementation)
      .then(address => this.implementation.attach(address));
    await this.clones.$clone(this.implementation);

    await expect(account.accessManager()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
    await expect(account.roleId()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
  });

  it('should revert if the immutable args are truncated', async function () {
    const account = await this.cloneWithArgs(ethers.dataSlice(this.args, 0, 27));

    await expect(account.accessManager()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
    await expect(account.roleId()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
  });

  it('should revert if the immutable args have trailing bytes', async function () {
    const account = await this.cloneWithArgs(ethers.concat([this.args, '0xdeadbeef']));

    await expect(account.accessManager()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
    await expect(account.roleId()).to.be.revertedWithCustomError(account, 'MissingImmutableArgs');
  });

  it('should reject a signature shorter than the 20-byte signer prefix without reverting', async function () {
    const account = await this.cloneWithArgs(this.args);

    await expect(account.$_rawSignatureValidation(ethers.id('some hash'), '0x1234')).to.eventually.be.false;
  });
});
