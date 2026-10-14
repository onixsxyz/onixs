#!/bin/bash
# Fork tests against Robinhood Chain mainnet, one test at a time with retries: public RPC nodes sometimes
# answer "Unknown state" for a block they served a moment earlier. Usage: ./fork-test.sh [match-test regex]
set -u
cd "$(dirname "$0")"
export FORK_URL="${FORK_URL:-https://robinhood.drpc.org}"
MATCH="${1:-.}"
TESTS=$(grep -oE "function (test[A-Za-z0-9_]+)" test/OnixsFork.t.sol | awk '{print $2}' | grep -E "$MATCH")
pass=0; fail=0; failed=()
for t in $TESTS; do
  ok=0
  for i in 1 2 3 4 5; do
    out=$(forge test --match-contract OnixsForkTest --match-test "${t}" --evm-version cancun -vv 2>&1)
    if echo "$out" | grep -q "^\[PASS\]"; then ok=1; break; fi
    echo "$out" | grep -qE "Unknown state|HTTP error|error sending request|database error" || break
    sleep 2
  done
  if [ $ok = 1 ]; then pass=$((pass+1)); echo "PASS $t"; echo "$out" | grep -E "^  (short|long|stock|gas)" | sort -u; else fail=$((fail+1)); failed+=("$t"); echo "FAIL $t"; echo "$out" | grep -E "FAIL|Error" | head -3; fi
done
echo "fork: $pass passed, $fail failed ${failed[*]:-}"
[ $fail = 0 ]
