import { Account } from "starknet";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "./createClientComponents";
import { Direction, updatePositionWithDirection } from "../utils";
import {
    getEntityIdFromKeys,
    getEvents,
    setComponentsFromEvents,
} from "@dojoengine/utils";
import { ContractComponents } from "./generated/contractComponents";
import type { IWorld } from "./generated/generated";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls(
    { client }: { client: IWorld },
    contractComponents: ContractComponents,
    { Position, Moves }: ClientComponents
) {
    const spawn = async (account: Account) => {
        const entityId = getEntityIdFromKeys([
            BigInt(account.address),
        ]) as Entity;

        const positionId = uuid();
        Position.addOverride(positionId, {
            entity: entityId,
            value: { player: BigInt(account.address), vec: { x: 10, y: 10 } },
        });

        const movesId = uuid();
        Moves.addOverride(movesId, {
            entity: entityId,
            value: {
                player: BigInt(account.address),
                remaining: 100,
                last_direction: 0,
            },
        });

        try {
            const { transaction_hash } = await client.actions.spawn({
                account,
            });

            setComponentsFromEvents(
                contractComponents,
                getEvents(
                    await account.waitForTransaction(transaction_hash, {
                        retryInterval: 100,
                    })
                )
            );
        } catch (e) {
            console.log(e);
            Position.removeOverride(positionId);
            Moves.removeOverride(movesId);
        } finally {
            // If override is removed too soon, defineSystem is called twice
            setTimeout(() => {
                Position.removeOverride(positionId);
                Moves.removeOverride(movesId);
            }, 1000);
        }
    };

    const move = async (account: Account, direction: Direction) => {
        const entityId = getEntityIdFromKeys([
            BigInt(account.address),
        ]) as Entity;

        const positionId = uuid();
        Position.addOverride(positionId, {
            entity: entityId,
            value: {
                player: BigInt(account.address),
                vec: updatePositionWithDirection(
                    direction,
                    getComponentValue(Position, entityId) as any
                ).vec,
            },
        });

        const movesId = uuid();
        Moves.addOverride(movesId, {
            entity: entityId,
            value: {
                player: BigInt(account.address),
                remaining:
                    (getComponentValue(Moves, entityId)?.remaining || 0) - 1,
            },
        });

        try {
            const { transaction_hash } = await client.actions.move({
                account,
                direction,
            });

            setComponentsFromEvents(
                contractComponents,
                getEvents(
                    await account.waitForTransaction(transaction_hash, {
                        retryInterval: 100,
                    })
                )
            );
        } catch (e) {
            console.log(e);
            Position.removeOverride(positionId);
            Moves.removeOverride(movesId);
        } finally {
            // If override is removed too soon, defineSystem is called twice
            setTimeout(() => {
                Position.removeOverride(positionId);
                Moves.removeOverride(movesId);
            }, 1000);
        }
    };

    return {
        spawn,
        move,
    };
}
