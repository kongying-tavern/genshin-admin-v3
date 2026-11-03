import { from, lastValueFrom, mergeMap, toArray } from 'rxjs'

export const promisePool = <T>(missions: (() => Promise<T>)[], limit = 6): Promise<T[]> => {
  return lastValueFrom(
    from(missions).pipe(
      mergeMap(mission => mission(), limit),
      toArray(),
    ),
  )
}
