const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toBn } = require("evm-bn");
const Big = require("big.js");

const E = toBn("2.718281828459045235");
const PI = toBn("3.141592653589793238");
const ZERO = toBn("0");
const ONE = toBn("1");
const MAX_UD60x18 = toBn("115792089237316195423570985008687907853269984665640564039457.584007913129639935");
const SQRT_MAX_UD60x18 = "340282366920938463463374607431.768211455999999999"
const MAX_WHOLE_UD60x18 = toBn("115792089237316195423570985008687907853269984665640564039457");

describe("Formula", () => {
  beforeEach(async () => {
    const MathTester = await ethers.getContractFactory("MathTester");
    mathTester = await MathTester.deploy();
  });


  describe("when the base is zero", function () {
    describe("when the exponent is zero", function () {
      it("returns 1", async function () {
        const x = ZERO;
        const y = ZERO;
        const expected = ONE;
        expect(expected).to.equal(await mathTester.pow(x, y));
      });
    });

    describe("when the exponent is not zero", function () {
      const testSets = [ONE, E, PI];

      for (let i = 0; i < testSets.length; i++) {
        const y = testSets[i];
        it(`takes 0 and ${y} and returns 0`, async () => {
          const x = ZERO;
          const expected = ZERO;
          expect(expected).to.equal(await mathTester.pow(x, y));
        });
      }
    });
  });

  describe("when the base is not zero", function () {
    describe("when the exponent is zero", function () {
      const testSets = [ONE, E, PI, MAX_UD60x18];
      const y = ZERO;

      for (let i = 0; i < testSets.length; i++) {
        const x = testSets[i];
        it(`takes ${x} and 0 and returns 1`, async () => {
          const expected = ONE;
          expect(expected).to.equal(await mathTester.pow(x, y));
        });
      }
    });

    describe("when the exponent is not zero", function () {
      describe("when the result overflows ud60x18", function () {
        const testSets = [
          [toBn("48740834812604276470.692694885616578542"), toBn("3e-18")], // smallest number whose cube doesn't fit within MAX_UD60x18
          [toBn(SQRT_MAX_UD60x18).add(1), toBn("2e-18")],
          [MAX_WHOLE_UD60x18, toBn("2e-18")],
          [MAX_UD60x18, toBn("2e-18")],
        ];

        for (let i = 0; i < testSets.length; i++) {
          const x = testSets[i][0];
          const y = testSets[i][1];
          it(`takes ${x} and ${y} and reverts`, async () => {
            await expect(mathTester.pow(x, y)).to.be.revertedWith(
              'PRBMath__MulDivFixedPointOverflow',
            );
          });
        }
      });

      describe("when the result does not overflow ud60x18", function () {
        const testSets = [
          ['0.001', toBn("0.001"), 3],
          ['0.1', toBn("0.1"), 2],
          ['1', toBn("1"), 1],
          ['2', toBn("2"), 5],
          ['2', toBn("2"), 100],
          ['2.718281828459045235', E, 2],
          ['100', toBn('100'), 4],
          ['3.141592653589793238', PI, 3],
          ['5.491', toBn("5.491"), 19],
          ['478.77', toBn("478.77"), 20],
          ['6452.166', toBn("6452.166"), 7],
          ['1e18', toBn("1e18"), 3],
          // ['48740834812604276470.692694885616578541', toBn("48740834812604276470.692694885616578541"), 3], // Biggest number whose cube fits within MAX_UD60x18
          [SQRT_MAX_UD60x18, toBn(SQRT_MAX_UD60x18), 2],
          ['115792089237316195423570985008687907853269984665640564039457', MAX_WHOLE_UD60x18, 1],
          ['115792089237316195423570985008687907853269984665640564039457.584007913129639935', MAX_UD60x18, 1],
        ];

        for (let i = 0; i < testSets.length; i++) {
          const x = testSets[i][0];
          const x18 = testSets[i][1];
          const y = testSets[i][2];
          it(`takes ${x18} and ${y} and returns the correct value`, async () => {
            const res = await mathTester.pow(x18, y);
            const actual = ethers.utils.formatEther(res);
            const expected = new Big(x).pow(y);
            expect(expected.toFixed(4)).to.be.equal(Big(actual).toFixed(4));
          });
        }
      });
    });
  });
});
