import { Adapter } from "../adapters/types";
import { OPTIMISM } from "../helpers/chains";
import { request, gql } from "graphql-request";
import { Chain } from "@defillama/sdk/build/general";
import { getUniqStartOfTodayTimestamp } from "../helpers/getUniSubgraphVolume";
import { BigNumber } from "ethers";
import type { ChainEndpoints } from "../adapters/types";

const UNIT = BigNumber.from("1000000000000000000");

const endpoints = {
  [OPTIMISM]: "https://api.lyra.finance/subgraph/optimism/v1/api",
};

interface IGetChainFeesParams {
  graphUrls: {
    [chains: string]: string;
  };
  timestamp?: number;
}

interface IDayFeesResponse {
  marketVolumeAndFeesSnapshots: Array<{
    vegaFees: string;
    varianceFees: string;
    spotPriceFees: string;
    optionPriceFees: string;
    liquidatorFees: string;
    smLiquidationFees: string;
    lpLiquidationFees: string;
  }>;
}

const graph = (graphUrls: ChainEndpoints) => {
  const dailyFeesQuery = gql`
    query ($timestamp: Int) {
      marketVolumeAndFeesSnapshots(
        where: { period: 86400, timestamp: $timestamp }
      ) {
        vegaFees
        varianceFees
        spotPriceFees
        optionPriceFees
        liquidatorFees
        smLiquidationFees
        lpLiquidationFees
      }
    }
  `;

  return (chain: Chain) => {
    return async (timestamp: number) => {
      const cleanTimestamp = getUniqStartOfTodayTimestamp(
        new Date(timestamp * 1000)
      );
      const previousDayFees: IDayFeesResponse = await request(
        graphUrls[chain],
        dailyFeesQuery,
        { timestamp: cleanTimestamp }
      ).catch((e) =>
        console.error(`Failed to get total fees on ${chain}: ${e.message}`)
      );

      const prevDayFeesSum =
        previousDayFees.marketVolumeAndFeesSnapshots.reduce(
          (acc, obj) => {
            let vals = {
              dailyFees:
                acc.dailyFees +
                BigNumber.from(obj.vegaFees)
                  .add(BigNumber.from(obj.varianceFees))
                  .add(BigNumber.from(obj.spotPriceFees))
                  .add(BigNumber.from(obj.optionPriceFees))
                  .add(BigNumber.from(obj.liquidatorFees))
                  .add(BigNumber.from(obj.smLiquidationFees))
                  .add(BigNumber.from(obj.lpLiquidationFees))
                  .div(UNIT)
                  .toNumber(),
            };

            return vals;
          },
          { dailyFees: 0 }
        );

      return {
        timestamp,
        dailyFees: prevDayFeesSum.dailyFees.toString(),
        dailyUserFees: prevDayFeesSum.dailyFees.toString(),
        dailySupplySideRevenue: prevDayFeesSum.dailyFees.toString(),
        dailyRevenue: "0",
        dailyHoldersRevenue: "0",
        dailyProtocolRevenue: "0"
      };
    };
  };
};

const adapter: Adapter = {
  adapter: {
    [OPTIMISM]: {
      fetch: graph(endpoints)(OPTIMISM),
      start: async () => 1656154800,
      meta: {
        methodology: {
          Fees: "All fees collected comes from user fees",
          UserFees: "Fees paid by users",
          SupplySideRevenue: "LPs revenue, from user fees",
          Revenue: "Governance have no revenue",
          HoldersRevenue: "Token holders have no revenue",
          ProtocolRevenue: "Protocol have no revenue"
        }
      }
    },
  },
};

export default adapter;
