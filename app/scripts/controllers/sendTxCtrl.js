'use strict';
var sendTxCtrl = function($scope, $sce, walletService) {
  $scope.etherBalance = $scope.etcBalance = $scope.usdBalance = $scope.eurBalance = $scope.btcBalance = "loading";
  $scope.unitReadable = "";
  $scope.transUnitReadable = "TRANS_standard";
  $scope.sendTxModal = new Modal(document.getElementById('sendTransaction'));
  $scope.txInfoModal = new Modal(document.getElementById('txInfoModal'));
  walletService.wallet = null;
  walletService.password = '';
  $scope.showAdvance = false;
  $scope.showRaw = false;
  $scope.replayContract = "0xaa1a6e3e6ef20068f7f8d8c835d2d22fd5116444";
  $scope.splitHex = "0x0f2c9329";
  $scope.Validator = Validator;

  // Tokens
  $scope.tokenVisibility = "hidden";
  $scope.tokens = Token.popTokens;
  $scope.customTokenField = false;

  $scope.tokenTx = {
    to: '',
    value: 0,
    id: -1,
    gasLimit: 150000
  };
  $scope.localToken = {
    contractAdd: "",
    symbol: "",
    decimals: "",
    type: "custom",
  };

  $scope.tx = {
    gasLimit: globalFuncs.urlGet('gaslimit') == null ? globalFuncs.defaultTxGasLimit : globalFuncs.urlGet('gaslimit'),
    data: globalFuncs.urlGet('data') == null ? "" : globalFuncs.urlGet('data'),
    to: globalFuncs.urlGet('to') == null ? "" : globalFuncs.urlGet('to'),
    unit: "ether",
    value: globalFuncs.urlGet('value') == null ? "" : globalFuncs.urlGet('value'),
    nonce: null,
    gasPrice: null,
    donate: false,
    sendMode: globalFuncs.urlGet('sendMode') == null ? 0 : globalFuncs.urlGet('value')
  }
  globalFuncs.urlGet('gaslimit') == null ? '' : $scope.showAdvance = true
  globalFuncs.urlGet('data') == null ? '' : $scope.showAdvance = true
  $scope.$watch(function() {
    if (walletService.wallet == null) return null;
    return walletService.wallet.getAddressString();
  }, function() {
    if (walletService.wallet == null) return;
    $scope.wallet = walletService.wallet;
    $scope.wd = true;
    $scope.setBalance();
    $scope.setTokens();
  });
  $scope.$watch('[tx.to,tx.value,tx.data,tx.sendMode]', function() {
    if ($scope.Validator.isValidAddress($scope.tx.to) && $scope.Validator.isPositiveNumber($scope.tx.value) && $scope.Validator.isValidHex($scope.tx.data)) {
      if ($scope.estimateTimer) clearTimeout($scope.estimateTimer);
      $scope.estimateTimer = setTimeout(function() {
        $scope.estimateGasLimit();
      }, 500);
    }
  }, true);

  // if there is a query string, show an warning at top of page
  if ( globalFuncs.urlGet('data') || globalFuncs.urlGet('value') || globalFuncs.urlGet('to') || globalFuncs.urlGet('gaslimit') ) $scope.hasQueryString = true

  $scope.estimateGasLimit = function() {
    var estObj = {
      to: $scope.tx.to,
      from: $scope.wallet.getAddressString(),
      value: ethFuncs.sanitizeHex(ethFuncs.decimalToHex(etherUnits.toWei($scope.tx.value, $scope.tx.unit)))
    }
    if ($scope.tx.data != "") estObj.data = ethFuncs.sanitizeHex($scope.tx.data);
    if ($scope.tx.sendMode == 1) estObj.data = $scope.splitHex + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.tx.to), 64) + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.wallet.getAddressString()), 64);
    else if ($scope.tx.sendMode == 2) estObj.data = $scope.splitHex + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.wallet.getAddressString()), 64) + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.tx.to), 64);
    if ($scope.tx.sendMode != 0) estObj.to = $scope.replayContract;
    ethFuncs.estimateGas(estObj, $scope.tx.sendMode == 2, function(data) {
      if (!data.error) $scope.tx.gasLimit = data.data;
    });
  }
  $scope.setBalance = function() {
    ajaxReq.getBalance($scope.wallet.getAddressString(), false, function(data) {
      if (data.error) {
        $scope.etherBalance = data.msg;
      } else {
        $scope.etherBalance = etherUnits.toEther(data.data.balance, 'wei');
        ajaxReq.getETHvalue(function(data) {
          $scope.usdBalance = etherUnits.toFiat($scope.etherBalance, 'ether', data.usd);
          $scope.eurBalance = etherUnits.toFiat($scope.etherBalance, 'ether', data.eur);
          $scope.btcBalance = etherUnits.toFiat($scope.etherBalance, 'ether', data.btc);
        });
      }
    });
    ajaxReq.getBalance($scope.wallet.getAddressString(), true, function(data) {
      if (data.error) {
        $scope.etcBalance = data.msg;
      } else {
        $scope.etcBalance = etherUnits.toEther(data.data.balance, 'wei');
      }
    });
  }
  $scope.$watch('tx', function(newValue, oldValue) {
    $scope.showRaw = false;
    $scope.sendTxStatus = "";
    if (oldValue.sendMode != newValue.sendMode && newValue.sendMode == 0) {
      $scope.tx.data = "";
      $scope.tx.gasLimit = globalFuncs.defaultTxGasLimit;
    }
  }, true);
  $scope.validateAddress = function() {
    return ethFuncs.validateEtherAddress($scope.tx.to)
  }
  $scope.toggleShowAdvance = function() {
    $scope.showAdvance = !$scope.showAdvance;
  }
  $scope.onDonateClick = function() {
    $scope.tx.to = globalFuncs.donateAddress;
    $scope.tx.value = "0.5";
    $scope.tx.donate = true;
  }
  $scope.generateTx = function() {
    if (!ethFuncs.validateEtherAddress($scope.tx.to)) {
      $scope.validateTxStatus = $sce.trustAsHtml(globalFuncs.getDangerText(globalFuncs.errorMsgs[5]));
      return;
    }
    var txData = uiFuncs.getTxData($scope);
    if ($scope.tx.sendMode != 0) {
      txData.to = $scope.replayContract;
      if ($scope.tx.sendMode == 1) txData.data = $scope.splitHex + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.tx.to), 64) + ethFuncs.padLeft(ethFuncs.getNakedAddress(txData.from), 64);
      else if ($scope.tx.sendMode == 2) txData.data = $scope.splitHex + ethFuncs.padLeft(ethFuncs.getNakedAddress(txData.from), 64) + ethFuncs.padLeft(ethFuncs.getNakedAddress($scope.tx.to), 64);
    }
    uiFuncs.generateTx(txData, $scope.tx.sendMode == 2, function(rawTx) {
      if (!rawTx.isError) {
        $scope.rawTx = rawTx.rawTx;
        $scope.signedTx = rawTx.signedTx;
        $scope.showRaw = true;
        $scope.validateTxStatus = $sce.trustAsHtml(globalFuncs.getDangerText(''));
      } else {
        $scope.showRaw = false;
        $scope.validateTxStatus = $sce.trustAsHtml(globalFuncs.getDangerText(rawTx.error));
      }
    });
  }
  $scope.sendTx = function() {
    $scope.sendTxModal.close();
    uiFuncs.sendTx($scope.signedTx, $scope.tx.sendMode == 2, function(resp) {
      if (!resp.isError) {
        $scope.sendTxStatus = $sce.trustAsHtml(globalFuncs.getSuccessText(globalFuncs.successMsgs[2] + "<br />" + resp.data + "<br /><a href='http://etherscan.io/tx/" + resp.data + "' target='_blank'> ETH TX via EtherScan.io </a> & <a href='http://gastracker.io/tx/" + resp.data + "' target='_blank'> ETC TX via GasTracker.io</a>"));
        $scope.setBalance();
      } else {
        $scope.sendTxStatus = $sce.trustAsHtml(globalFuncs.getDangerText(resp.error));
      }
    });
  }
  $scope.transferAllBalance = function() {
    uiFuncs.transferAllBalance($scope.wallet.getAddressString(), $scope.tx.gasLimit, $scope.tx.sendMode == 2, function(resp) {
      if (!resp.isError) {
        $scope.tx.unit = resp.unit;
        $scope.tx.value = resp.value;
      } else {
        $scope.showRaw = false;
        $scope.validateTxStatus = $sce.trustAsHtml(resp.error);
      }
    });
  }


  $scope.changeTxUnit = function(unit, unitReadable) {
    $scope.tx.unit = unit;
    if ( unit == 'ETH' || unit == 'onlyETH' || unit == 'onlyETC' ) {
      $scope.unitReadable = '';
      $scope.transUnitReadable = unitReadable;
    } else {
      $scope.unitReadable = unitReadable;
      $scope.transUnitReadable = '';
    }
    $scope.dropdownAmount = false;
  }

  // Tokens
  $scope.setTokens = function() {
    $scope.tokenObjs = [];
    for (var i = 0; i < $scope.tokens.length; i++) {
      $scope.tokenObjs.push(new Token($scope.tokens[i].address, $scope.wallet.getAddressString(), $scope.tokens[i].symbol, $scope.tokens[i].decimal, $scope.tokens[i].type));
            $scope.tokenObjs[$scope.tokenObjs.length-1].setBalance();
    }
    var storedTokens = localStorage.getItem("localTokens") != null ? JSON.parse(localStorage.getItem("localTokens")) : [];
    for (var i = 0; i < storedTokens.length; i++) {
      $scope.tokenObjs.push(new Token(storedTokens[i].contractAddress, $scope.wallet.getAddressString(), globalFuncs.stripTags(storedTokens[i].symbol), storedTokens[i].decimal, storedTokens[i].type));
            $scope.tokenObjs[$scope.tokenObjs.length-1].setBalance();
        }
    $scope.tokenTx.id = -1;
  }
  $scope.$watch('[tokenTx.to,tokenTx.value,tokenTx.id]', function() {
    if ($scope.tokenObjs !== undefined && $scope.tokenObjs[$scope.tokenTx.id] !== undefined && $scope.Validator.isValidAddress($scope.tokenTx.to) && $scope.Validator.isPositiveNumber($scope.tokenTx.value)) {
      if ($scope.estimateTimer) clearTimeout($scope.estimateTimer);
      $scope.estimateTimer = setTimeout(function() {
        $scope.estimateGasLimit();
      }, 500);
    }
  }, true);

  $scope.saveTokenToLocal = function() {
    try {
      if (!ethFuncs.validateEtherAddress($scope.localToken.contractAdd)) throw globalFuncs.errorMsgs[5];
      else if (!globalFuncs.isNumeric($scope.localToken.decimals) || parseFloat($scope.localToken.decimals) < 0) throw globalFuncs.errorMsgs[7];
      else if (!globalFuncs.isAlphaNumeric($scope.localToken.symbol) || $scope.localToken.symbol == "") throw globalFuncs.errorMsgs[19];
      var storedTokens = localStorage.getItem("localTokens") != null ? JSON.parse(localStorage.getItem("localTokens")) : [];
      storedTokens.push({
        contractAddress: $scope.localToken.contractAdd,
        symbol: $scope.localToken.symbol,
        decimal: parseInt($scope.localToken.decimals),
        type: $scope.localToken.type
      });
      $scope.localToken = {
        contractAdd: "",
        symbol: "",
        decimals: "",
        type: "custom"
      };
      localStorage.setItem("localTokens", JSON.stringify(storedTokens));
      $scope.setTokens();
      $scope.validateLocalToken = $sce.trustAsHtml('');
      $scope.customTokenField = false;
    } catch (e) {
      $scope.validateLocalToken = $sce.trustAsHtml(globalFuncs.getDangerText(e));
    }
  }
  $scope.removeTokenFromLocal = function(tokenSymbol) {
    var storedTokens = localStorage.getItem("localTokens") != null ? JSON.parse(localStorage.getItem("localTokens")) : [];
    // remove from localstorage so it doesn't show up on refresh
    for (var i = 0; i < storedTokens.length; i++)
    if (storedTokens[i].symbol === tokenSymbol) {
      storedTokens.splice(i, 1);
      break;
    }
    localStorage.setItem("localTokens", JSON.stringify(storedTokens));
    // remove from tokenObj so it removes from display
    for (var i = 0; i < $scope.tokenObjs.length; i++)
    if ($scope.tokenObjs[i].symbol === tokenSymbol) {
      $scope.tokenObjs.splice(i, 1);
      break;
    }
  }

};
module.exports = sendTxCtrl;
