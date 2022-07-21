<template>
  <Modal trigger-text="Terms & Conditions" trigger-classes="underline hover:opacity-90">
    <h2 class="font-bold">Terms & Conditions of Use</h2>
    <div class="py-4">
      <div>
        <h3>1. Scope</h3>
        <h3>1.1.</h3>
        <p>
          These terms and conditions govern the contractual relationship between the user and
          Brainbot Technologies AG (hereinafter referred to as BBT) regarding the use of the front
          end interfacing with the Beamer protocol via https://app.beamerbridge.com/ (hereinafter
          referred to as the Beamer App). BBT and the user are collectively referred to as the
          "parties".
        </p>
        <h3>1.2.</h3>
        <p>
          There are no verbal side agreements between the parties. These terms and conditions apply
          exclusively.
        </p>
        <h3>2. Conclusion of the contract</h3>
        <p>The contract between the parties is concluded when the user accesses the Beamer App.</p>
        <h3>3. Right of withdrawal</h3>
        <p>
          There is no right of withdrawal. However, the user is free at any time to delete or
          uninstall the Beamer App from the device used and/or to delete its browser cache and thus
          delete the accessed version of the Beamer App.
        </p>

        <h3>4. Access to the Beamer App</h3>
        <h3>4.1.</h3>
        <p>The Beamer App can be accessed via https://app.beamerbridge.com.</p>
        <h3>4.2.</h3>
        <p>The installation of the Beamer App is not part of the contract.</p>
        <h3>4.3.</h3>
        <p>
          The user may be offered updates of the Beamer App for download, which may contain bug
          fixes and new functionalities as long as the download offer is not discontinued. BBT
          therefore recommends regular updates.
        </p>
        <h3>4.4.</h3>
        <p>
          BBT is free to stop all access to download and update offers of the Beamer App via its
          web servers at any time.
        </p>
        <h3>5. Rights of use</h3>
        <h3>5.1.</h3>
        <p>The user may use the Beamer App on any number of computers for any lawful purposes.</p>
        <h3>5.2.</h3>
        <p>
          The user may acquire further usage rights to the Beamer App from the respective rights
          holders by concluding separate licence agreements with these rights holders under the
          conditions of the respective licence. The licence texts are included in the source code.
          In this case, the use of the Beamer App is not covered by this contract, but is based
          solely on the conditions of the respective licence. If several licences are used, these
          are contained in the source code that is accessible to the user in accordance with
          Section 4 (2).
        </p>
        <h3>6. Remuneration</h3>
        <p>
          The user receives and can use/interact with the Beamer App free of charge. Fees may be
          applied by other participants of the network for certain interactions.
        </p>
        <h3>7. Beta Version/Disclaimer/Liability</h3>
        <p class="font-bold">
          The Beamer App is a beta version of experimental open source software released as a beta
          version under an MIT license and may contain errors and/or bugs. No guarantee or
          representation whatsoever is made regarding its suitability (or its use) for any purpose
          or regarding its compliance with any applicable laws and regulations. Use of the Beamer
          App is at the user’s risk and discretion and by using Beamer the user warrants and
          represents to have read this disclaimer, understand its contents, assume all risk related
          thereto and hereby releases, waives, discharges and covenants not to hold liable BBT or
          any of its officers, employees or affiliates from and for any direct or indirect damage
          resulting from the Beamer App or the use thereof. Such to the extent as permissible by
          applicable laws and regulations.
        </p>
        <h3>8. Third Party Services</h3>
        <p>
          The Beamer App gives the user the choice to interact directly with web services provided
          by third parties. These web services are unaffiliated with BBT and carried out solely on
          the discretion of the user and based on the respective terms and conditions agreed
          between the user and the third party or web service. BBT does not receive any form of
          remuneration or inducement from these third parties. BBT gives neither express or implied
          representations nor express or implied warranties with regard to the applications or the
          services provided by third parties. This includes but is not limited to the validity of
          the license, suitability, quality, functionality, availability, access of/to the
          application or service. BBT therefore cannot be held responsible or liable for these
          applications or services or for any damages related to using these applications or
          services.
        </p>
        <h3>9. Applicable law</h3>
        <p>
          The contractual relationship between the parties and all disputes that arise from or in
          connection with this contractual relationship are subject to the law of Germany. If the
          user is a consumer and does not have his habitual residence in Germany, the statutory
          regulations for consumer protection in the state of his habitual residence remain
          unaffected, if and to the extent that these regulations may not be deviated from under
          the law of the state of his habitual residence. The United Nations Convention on
          Contracts for the International Sale of Goods does not apply.
        </p>
        <h3>10. Place of jurisdiction</h3>
        <p>
          Insofar as the user is a merchant, legal entity under public law or special fund under
          public law or has no general place of jurisdiction in Germany, or has moved his domicile
          or habitual residence outside of Germany after conclusion of the contract, or his
          domicile or habitual residence is not known at the time the action is brought, the
          exclusive place of jurisdiction for all disputes arising from and in connection with the
          contractual relationship between the parties in all these cases is the registered office
          of BBT.
        </p>
        <h3>11. Dispute settlement</h3>
        <h3>11.1.</h3>
        <p>
          The European Commission provides a platform that enables disputes between consumers and
          businesses to be settled online (OS platform). The OS platform can be reached under the
          following link:
          <a href="https://ec.europa.eu/consumers/odr" target="_blank"
            >https://ec.europa.eu/consumers/odr</a
          >. BBTs email address is: <a href="mailto:contact@brainbot.com">contact@brainbot.com</a>.
        </p>
        <h3>11.2.</h3>
        <p>
          BBT is not obliged to participate in dispute settlement procedures before consumer
          arbitration boards.
        </p>
        <h3>12. Severability Clause</h3>
        <p>
          Should one or more provisions of these Terms and Conditions of Use be or become
          ineffective, this shall not affect the validity of the remaining provisions. The
          ineffective provisions shall be replaced with effective provisions that match the purpose
          of those ineffective provisions.
        </p>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/layout/Modal.vue';
</script>

<style lang="css" scoped>
.box h2 {
  @apply text-2xl font-bold py-6;
}

.box h3 {
  @apply text-xl font-bold pb-2;
}

.box p {
  @apply text-lg pb-10;
}

.box a {
  @apply underline hover:opacity-90;
}
</style>
