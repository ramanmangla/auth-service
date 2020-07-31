/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the
 Apache License, Version 2.0 (the 'License') and you may not use these files
 except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop
 files are distributed onan 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 ANY KIND, either express or implied. See the License for the specific language
 governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Raman Mangla <ramanmangla@google.com>
 --------------
 ******/

import Logger from '@mojaloop/central-services-logger'
import * as Challenge from '../../../../../../../src/lib/challenge'
import * as Domain from '../../../../../../../src/server/domain/thirdpartyRequests/transactions/{ID}/authorizations'
import { Request } from '@hapi/hapi'
import { Consent } from '../../../../../../../src/model/consent'
import { Scope } from '../../../../../../../src/model/scope'
import { Enum } from '@mojaloop/central-services-shared'
// import { NotFoundError } from '../../../../../../../src/model/errors'
import { thirdPartyRequest } from '../../../../../../../src/lib/requests'
import {
  consentDB,
  scopeDB
} from '../../../../.././../../src/lib/db'
import * as Handler from '../../../../../../../src/server/handlers/thirdpartyRequests/transactions/{ID}/authorizations'

/*
 * Mock Handler Functions
 */
const mockIsPayloadPending = jest.spyOn(Domain, 'isPayloadPending')
const mockHasMatchingScope = jest.spyOn(Domain, 'hasMatchingScopeForPayload')
const mockPutErrorRequest = jest.spyOn(Domain, 'putErrorRequest')
const mockHasActiveCredential = jest.spyOn(
  Domain,
  'hasActiveCredentialForPayload'
)

const mockVerifyChallenge = jest.spyOn(Challenge, 'verifySignature')

const mockRetrieveConsent = jest.spyOn(consentDB, 'retrieve')
const mockRetrieveAllScopes = jest.spyOn(scopeDB, 'retrieveAll')

const mockLoggerPush = jest.spyOn(Logger, 'push')
const mockLoggerError = jest.spyOn(Logger, 'error')

const mockPutThirdpartyTransactionsAuth = jest.spyOn(
  thirdPartyRequest,
  'putThirdpartyRequestsTransactionsAuthorizations'
)

// const mockValidateAndVerifySignature = jest.spyOn(
//   Handler,
//   'validateAndVerifySignature'
// )

/*
 * Mock Request and Response Resources
 */
const payload: Domain.AuthPayload = {
  consentId: '1234',
  sourceAccountId: 'pisp-2343-f223',
  status: 'PENDING',
  challenge: 'QuoteResponse Object JSON string',
  value: 'YjYyODNkOWUwZjUxNzOThmMjllYjE2Yg=='
}

// @ts-ignore
const request: Request = {
  headers: {
    'fspiop-source': 'switch'
  },
  params: {
    id: '1234'
  },
  payload: payload
}

// @ts-ignore
// const h: ResponseToolkit = {
//   response: (): ResponseObject => {
//     return {
//       code: (statusCode: number): ResponseObject => {
//         return statusCode as unknown as ResponseObject
//       }
//     } as unknown as ResponseObject
//   }
// }

/*
 * Mock consent and scopes
 */
const mockConsent: Consent = {
  id: payload.consentId,
  credentialStatus: 'ACTIVE',
  credentialPayload: 'Mock public key payload'
}

const mockScopes: Scope[] = [
  {
    consentId: payload.consentId,
    action: 'account.transfer',
    accountId: payload.sourceAccountId
  },
  {
    consentId: payload.consentId,
    action: 'account.balance',
    accountId: 'dfsp-2321-ahsh'
  }
]

/*
 * Incoming POST `/thirdpartyRequests/transaction/{ID}/authorizations'
 * Async Handler Unit Tests
 */
describe('validateAndVerifySignature', (): void => {
  beforeEach((): void => {
    // Positive flow values for a successful 202 return
    mockIsPayloadPending.mockReturnValue(true)
    mockHasActiveCredential.mockReturnValue(true)
    mockHasMatchingScope.mockReturnValue(true)
    mockVerifyChallenge.mockReturnValue(true)
    // mockPutErrorRequest.mockImplementation(async (): Promise<void> => {})
    mockPutErrorRequest.mockResolvedValue(undefined)

    mockLoggerPush.mockReturnValue(null)
    mockLoggerError.mockReturnValue(null)

    mockRetrieveConsent.mockResolvedValue(mockConsent)
    mockRetrieveAllScopes.mockResolvedValue(mockScopes)

    mockPutThirdpartyTransactionsAuth.mockResolvedValue({
      statusCode: 200,
      headers: null,
      data: Buffer.from('Response Data')
    })
  })

  it('Should make PUT outgoing request for successful verification',
    async (): Promise<void> => {
      await Handler.validateAndVerifySignature(request)

      expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
      expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
      expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
      expect(mockHasActiveCredential).toHaveBeenCalledWith(mockConsent)
      expect(mockHasMatchingScope).toHaveBeenCalledWith(mockScopes, payload)

      expect(mockVerifyChallenge).toHaveBeenCalledWith(
        payload.challenge,
        payload.value,
        mockConsent.credentialPayload
      )

      expect(mockPutThirdpartyTransactionsAuth).toHaveBeenCalledWith(
        payload,
        request.params.id,
        request.headers[Enum.Http.Headers.FSPIOP.SOURCE]
      )
    })

  it('Should return a Mojaloop 3100 (Bad Request) for non `PENDING` payload',
    async (): Promise<void> => {
      // Active Payload
      mockIsPayloadPending.mockReturnValue(false)

      await Handler.validateAndVerifySignature(request)

      expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
      // Error
      expect(mockPutErrorRequest).toHaveBeenCalledWith(
        request,
        '3100',
        'Bad Request'
      )
    })

  it('Should return a Mojaloop 3100 (Bad Request) for no `ACTIVE` credentials',
    async (): Promise<void> => {
    // Inactive credential
      mockHasActiveCredential.mockReturnValue(false)

      await Handler.validateAndVerifySignature(request)

      expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
      expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
      expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
      expect(mockHasMatchingScope).toHaveBeenCalledWith(mockScopes, payload)
      expect(mockHasActiveCredential).toHaveBeenCalledWith(mockConsent)
      // Error
      expect(mockPutErrorRequest).toHaveBeenCalledWith(
        request,
        '3100',
        'Bad Request'
      )
    })

  // it('Should return a Mojaloop 2000 (Forbidden) response for no matching consent scope', async (): Promise<void> => {
  //   // No matching scope for the consent in the DB
  //   mockHasMatchingScope.mockReturnValue(false)

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockHasMatchingScope).toHaveBeenCalledWith(mockScopes, payload)
  //   expect(mockHasMatchingScope).toReturnWith(false)
  //   // Error
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '2000', 'Forbidden')
  // })

  // it('Should return a Mojaloop 2000 (Not Found) for payload consent not existing', async (): Promise<void> => {
  //   // Requested Consent not in the DB
  //   mockRetrieveConsent.mockRejectedValue(
  //     new NotFoundError('Consent', payload.consentId)
  //   )

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockLoggerPush).toHaveBeenCalled()
  //   expect(mockLoggerError).toHaveBeenCalled()
  //   // Error
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '2000', 'Not Found')
  // })

  // it('Should return a Mojaloop 2000 (Server Error) response for error in retrieving consent', async (): Promise<void> => {
  //   mockRetrieveConsent.mockRejectedValue(
  //     new Error()
  //   )

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockLoggerPush).toHaveBeenCalled()
  //   expect(mockLoggerError).toHaveBeenCalled()
  //   // Error
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '2000', 'Server Error')
  // })

  // it('Should return a Mojaloop 2000 (Forbidden) response for no associated consent scopes', async (): Promise<void> => {
  //   // Consent does not have any scopes in DB
  //   mockRetrieveAllScopes.mockRejectedValue(
  //     new NotFoundError('Consent Scopes', payload.consentId)
  //   )

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockLoggerPush).toHaveBeenCalled()
  //   expect(mockLoggerError).toHaveBeenCalled()
  //   // Error
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '2000', 'Forbidden')
  // })

  // it('Should return a Mojaloop 2000 (Server Error) for error in retrieving scopes', async (): Promise<void> => {
  //   mockRetrieveAllScopes.mockRejectedValue(
  //     new Error()
  //   )

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockLoggerPush).toHaveBeenCalled()
  //   expect(mockLoggerError).toHaveBeenCalled()
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '2000', 'Server Error')
  // })

  // it('Should return a Mojaloop 3100 (Bad Request) for wrong signature', async (): Promise<void> => {
  //   mockVerifyChallenge.mockReturnValue(false)

  //   const response = await post(request, h)

  //   // Accepted Acknowledgement
  //   expect(response).toBe(Enum.Http.ReturnCodes.ACCEPTED.CODE)

  //   jest.runAllImmediates()

  //   expect(setImmediate).toHaveBeenCalled()
  //   expect(mockIsPayloadPending).toHaveBeenCalledWith(payload)
  //   expect(mockRetrieveConsent).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockRetrieveAllScopes).toHaveBeenCalledWith(payload.consentId)
  //   expect(mockHasActiveCredential).toHaveBeenCalledWith(mockConsent)
  //   expect(mockHasMatchingScope).toHaveBeenCalledWith(mockScopes, payload)
  //   expect(mockVerifyChallenge).toHaveBeenCalledWith(
  //     payload.challenge,
  //     payload.value,
  //     mockConsent.credentialPayload
  //   )
  //   // Error
  //   expect(mockPutErrorRequest).toHaveBeenCalledWith(request, '3100', 'Bad Request')
  // })
})

// describe('handlers/thirdpartyRequests/transactions/{ID}/authorizations.test.ts',
//   (): void => {
//     beforeEach((): void => {
//       mockValidateAndVerifySignature.mockResolvedValue(undefined)
//     })

//     it('Should return 202 (Accepted) and call async handler',
//       (): void => {
//         const response = Handler.post(request, h)

//         expect(mockValidateAndVerifySignature).toHaveBeenCalledWith(request)
//         expect(response.code).toEqual(Enum.Http.ReturnCodes.ACCEPTED.CODE)
//       })
//   })
